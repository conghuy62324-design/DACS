"use client"
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
import { isClosedOrderStatus, normalizeSeatValue, readPaymentMethodsFromStorage, type PaymentMethod } from '@/lib/payment-client';
import {
  Utensils,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Sun,
  Moon
} from 'lucide-react';

interface MenuItem {
  id: string;
  nameVi: string;
  nameEn: string;
  descriptionVi?: string;
  descriptionEn?: string;
  categoryId?: string;
  categoryName?: string;
  price: number;
  image: string;
  rating: number;
}

interface TableInfo {
  table: string;
  floor: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface InventoryEntry {
  initial: number;
  sold: number;
  incoming: number;
}

interface OrderItem {
  id: string;
  qty: number;
}

interface OrderType {
  id: string;
  table: string;
  floor: string;
  customer: string;
  items: OrderItem[];
  total: number;
  status: string;
  handler: string;
  createdAt: string;
}

const normalizeOrderWorkflowStatus = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const isImageLikeCategoryIcon = (value?: string) => {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/') || value.startsWith('/');
};

const getInventoryQuantity = (entry?: InventoryEntry) => {
  // If no entry exists yet (uninitialized), assume available (999) 
  // to avoid locking out the menu during sync. 
  // Admin will overwrite this with real data upon loading dashboard.
  if (!entry) return 999;
  return entry.initial + entry.incoming - entry.sold;
};

export default function RestaurantMenu() {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [isDark, setIsDark] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryStock, setInventoryStock] = useState<Record<string, InventoryEntry>>({});
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [placedOrderIds, setPlacedOrderIds] = useState<string[]>([]);

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isInfoConfirmed, setIsInfoConfirmed] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2200);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    const f = params.get('floor');
    if (t || f) {
      const info: TableInfo = { table: t || '', floor: f || '' };
      setTableInfo(info);
      const nameKey = `customerName_${info.table}_${info.floor}`;
      const phoneKey = `customerPhone_${info.table}_${info.floor}`;
      const savedName = localStorage.getItem(nameKey);
      const savedPhone = localStorage.getItem(phoneKey);
      if (savedName && savedPhone) {
        setCustomerName(savedName);
        setCustomerPhone(savedPhone);
        // We no longer setIsInfoConfirmed(true) here automatically
        // to ensure the user can verify their info before entering the menu.
      }

      const syncOccupied = async () => {
        try {
          const res = await fetch('/api/tables');
          if (res.ok) {
            const currentTables = await res.json() as any[];
            const next = currentTables.map(tbl => {
              if (normalizeSeatValue(tbl.table) === normalizeSeatValue(info.table) && 
                  normalizeSeatValue(tbl.floor) === normalizeSeatValue(info.floor)) {
                return { ...tbl, status: tbl.status === 'empty' ? 'occupied' : tbl.status };
              }
              return tbl;
            });
            await fetch('/api/tables', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next)
            });
          }
        } catch (err) {
          console.error('Failed to sync occupied status', err);
        }
      };
      syncOccupied();
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('placedOrderIds');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPlacedOrderIds(parsed.map(value => String(value)));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchStock = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventoryStock(data);
      }
    } catch (err) {
      console.error('Failed to fetch inventory from server', err);
    }
  }, []);

  useEffect(() => {
    fetchStock();
    const interval = window.setInterval(fetchStock, 5000);
    return () => window.clearInterval(interval);
  }, [fetchStock]);

  const loadAll = useCallback(async () => {
    try {
      const [menuRes, categoriesRes, ordersRes, pmRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
        fetch('/api/orders'),
        fetch('/api/payment-methods')
      ]);
      const [menuData, categoriesData, ordersData, pmData] = await Promise.all([
        menuRes.json(),
        categoriesRes.json(),
        ordersRes.json(),
        pmRes.json()
      ]);
      setMenuItems(menuData);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      if (Array.isArray(pmData)) {
        setPaymentMethods(pmData.filter((m: any) => m.active));
        localStorage.setItem('paymentMethods', JSON.stringify(pmData));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    try {
      sessionStorage.setItem('placedOrderIds', JSON.stringify(placedOrderIds));
    } catch {
      // ignore
    }
  }, [placedOrderIds]);

  const getAvailableStock = useCallback((id: string) => {
    return getInventoryQuantity(inventoryStock[id]);
  }, [inventoryStock]);

  useEffect(() => {
    setCart(prev => {
      let changed = false;
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([id, qty]) => {
        const available = getAvailableStock(id);
        if (available <= 0) {
          changed = true;
          return;
        }
        const safeQty = Math.min(qty, available);
        if (safeQty !== qty) changed = true;
        next[id] = safeQty;
      });
      return changed ? next : prev;
    });
  }, [getAvailableStock]);

  const addToCart = useCallback((id: string) => {
    const available = getAvailableStock(id);
    if (available <= 0) {
      showToast(lang === 'vi' ? 'Món này hiện đã hết hàng' : 'This item is out of stock', 'error');
      return;
    }
    setCart(prev => ({
      ...prev,
      [id]: Math.min((prev[id] || 0) + 1, available)
    }));
    // No toast on add — show only when order is confirmed
  }, [getAvailableStock]);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const available = getAvailableStock(id);
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: Math.min(newQty, available) };
    });
  };

  const cartEntries = Object.entries(cart);
  const totalPrice = cartEntries.reduce((total, [id, qty]) => {
    const item = menuItems.find(m => m.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const totalItems = cartEntries.reduce((total, [, qty]) => total + qty, 0);

  useEffect(() => {
    if (totalItems === 0) setMobileCartOpen(false);
  }, [totalItems]);

  const formatCurrency = (value: number | string) =>
    Number(value || 0).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const menuSections = categories
    .map(category => ({
      ...category,
      items: menuItems.filter(item => item.categoryId === category.id || item.categoryName === category.name),
    }))
    .filter(section => section.items.length > 0);

  const navSections = useMemo(() => [
    ...menuSections,
  ], [menuSections]);

  const tableOpenOrders = tableInfo
    ? orders.filter(order =>
        normalizeSeatValue(order.table) === normalizeSeatValue(tableInfo.table) &&
        normalizeSeatValue(order.floor) === normalizeSeatValue(tableInfo.floor) &&
        !isClosedOrderStatus(order.status)
      )
    : [];

  const visibleKitchenOrders = tableOpenOrders.filter(order => {
    const normalized = normalizeOrderWorkflowStatus(order.status);
    return !normalized.includes('nau xong') && !normalized.includes('cooked') && !normalized.includes('phuc vu') && !normalized.includes('served') && !normalized.includes('tu choi') && !normalized.includes('rejected');
  });

  const groupedKitchenItems = useMemo(() => {
    const grouped = new Map<string, { id: string; qty: number; total: number; statuses: string[] }>();
    visibleKitchenOrders.forEach(order => {
      order.items.forEach(item => {
        const menuItem = menuItems.find(menu => menu.id === item.id);
        const qty = Number(item.qty || 0);
        const price = Number(menuItem?.price || 0);
        const current = grouped.get(item.id);
        if (current) {
          current.qty += qty;
          current.total += price * qty;
          if (order.status && !current.statuses.includes(order.status)) current.statuses.push(order.status);
          return;
        }
        grouped.set(item.id, { id: item.id, qty, total: price * qty, statuses: order.status ? [order.status] : [] });
      });
    });
    return Array.from(grouped.values());
  }, [menuItems, visibleKitchenOrders]);

  const existingOrderItemsCount = visibleKitchenOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0),
    0
  );

  const displayOrderItemsCount = totalItems + existingOrderItemsCount;
  const existingOrdersTotal = visibleKitchenOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const displayGrandTotal = totalPrice + existingOrdersTotal;
  const featuredPaymentMethod = paymentMethods[0] || null;

  // canPayNow: chỉ cho thanh toán khi có món trong giỏ
  const canPayNow = totalItems > 0;

  const placeOrder = useCallback(async () => {
    if (!tableInfo || totalItems === 0) return null;
    setIsLoading(true);
    try {
      const payload = {
        table: tableInfo.table,
        floor: tableInfo.floor,
        customer: customerName,
        phone: customerPhone,
        items: cartEntries.map(([id, qty]) => ({ id, qty })),
        total: totalPrice,
        status: 'Chờ xử lý'
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const ordId = data?.order?.id;
        if (ordId) {
          setPlacedOrderIds(prev => [...prev, String(ordId)]);
          setCart({});
          // Show SUCCESS modal with animated checkmark
          setToastType('success');
          setToastMsg(lang === 'vi' ? 'Đặt món thành công!' : 'Order placed!');
          window.setTimeout(() => setToastMsg(''), 2500);

          const newStock = { ...inventoryStock };
          cartEntries.forEach(([id, qty]) => {
            if (newStock[id]) newStock[id].sold += qty;
          });
          await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStock)
          });
          setInventoryStock(newStock);

          const tRes = await fetch('/api/tables');
          if (tRes.ok) {
            const currentTables = await tRes.json() as any[];
            const next = currentTables.map(tbl => {
              if (normalizeSeatValue(tbl.table) === normalizeSeatValue(tableInfo.table) &&
                  normalizeSeatValue(tbl.floor) === normalizeSeatValue(tableInfo.floor)) {
                return { ...tbl, status: 'ordering' };
              }
              return tbl;
            });
            await fetch('/api/tables', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next)
            });
          }
          return data?.order || null;
        } else {
          setToastType('error');
          setToastMsg(lang === 'vi' ? 'Không nhận được phản hồi từ server' : 'No response from server');
          window.setTimeout(() => setToastMsg(''), 2500);
        }
      } else {
        let errorMsg = lang === 'vi' ? 'Đặt món thất bại' : 'Order failed';
        try {
          const errData = await res.json();
          if (errData?.error) errorMsg = errData.error;
        } catch { }
        setToastType('error');
        setToastMsg(errorMsg);
        window.setTimeout(() => setToastMsg(''), 2500);
      }
    } catch (e) {
      console.error(e);
      setToastType('error');
      setToastMsg(lang === 'vi' ? 'Lỗi kết nối, vui lòng thử lại' : 'Connection error, please try again');
      window.setTimeout(() => setToastMsg(''), 2500);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [tableInfo, totalItems, customerName, customerPhone, cartEntries, totalPrice, lang, inventoryStock]);

  const handlePayNow = useCallback(async () => {
    if (isLoading) return;
    if (totalItems > 0) {
      const createdOrder = await placeOrder();
      if (createdOrder) setPaymentModalOpen(true);
      return;
    }
    if (tableOpenOrders.length > 0) setPaymentModalOpen(true);
    else {
      setPaymentModalOpen(true);
    }
  }, [totalItems, tableOpenOrders.length, placeOrder, isLoading]);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategoryId(id);
  };

  const ui = {
    vi: {
      header: "Thực đơn hôm nay",
      order: "Đơn hàng",
      total: "TỔNG TIỀN",
      btn: "XÁC NHẬN ĐẶT MÓN",
      empty: "Giỏ hàng đang trống",
      table: tableInfo ? `Bàn số ${tableInfo.table} • Tầng ${tableInfo.floor}` : '',
      items: "Món",
      prepTime: "15 phút"
    },
    en: {
      header: "Today's Menu",
      order: "Your Order",
      total: "TOTAL PRICE",
      btn: "PLACE ORDER NOW",
      empty: "Your cart is empty",
      table: tableInfo ? `Table ${tableInfo.table} • Floor ${tableInfo.floor}` : '',
      items: "Items",
      prepTime: "15 Mins"
    }
  };

  if (tableInfo && !isInfoConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-zinc-900/95 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-orange-400">{lang === 'vi' ? 'Thông tin bàn' : 'Table check-in'}</p>
          <h2 className="mt-3 text-2xl font-black">{lang === 'vi' ? 'Xác nhận thông tin' : 'Confirm your details'}</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'Số bàn' : 'Table'}</p>
              <p className="mt-1 text-lg font-bold">{tableInfo.table || '--'}{tableInfo.floor ? ` • Floor ${tableInfo.floor}` : ''}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'Tên' : 'Name'}</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-2 w-full bg-transparent text-white outline-none" placeholder="..." />
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'SĐT' : 'Phone'}</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} inputMode="numeric" className="mt-2 w-full bg-transparent text-white outline-none" placeholder="..." />
            </div>
          </div>
          <button
            disabled={!customerName.trim() || !customerPhone.trim()}
            onClick={() => {
              const nameKey = `customerName_${tableInfo.table}_${tableInfo.floor}`;
              const phoneKey = `customerPhone_${tableInfo.table}_${tableInfo.floor}`;
              localStorage.setItem(nameKey, customerName.trim());
              localStorage.setItem(phoneKey, customerPhone.trim());
              setIsInfoConfirmed(true);
            }}
            className="mt-5 w-full rounded-[1.35rem] bg-orange-500 py-3 text-sm font-bold disabled:opacity-50"
          >
            {lang === 'vi' ? 'Vào menu' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${isDark ? 'bg-zinc-950 text-white' : 'bg-orange-50 text-zinc-900'}`} style={{ paddingBottom: displayOrderItemsCount > 0 ? '5rem' : 0 }}>
      <div className="max-w-7xl mx-auto p-4 lg:p-10 flex flex-col lg:flex-row gap-10">
        {toastMsg && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className={`rounded-[2rem] border-2 p-10 flex flex-col items-center justify-center gap-6 shadow-2xl animate-in zoom-in-95 duration-300 ${
              toastType === 'success'
                ? 'border-emerald-400 bg-emerald-950/95 text-emerald-100'
                : 'border-red-400 bg-red-950/95 text-red-100'
            }`}>
              {/* Animated checkmark circle */}
              <div className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
                toastType === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-red-500 text-white'
              }`}>
                {toastType === 'success' ? (
                  <>
                    {/* Rotating ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-300 opacity-30" />
                    {/* Checkmark SVG with draw animation */}
                    <svg className="w-12 h-12 animate-[checkDraw_0.6s_ease-out_forwards]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {/* Pulse rings */}
                    <div className="absolute inset-0 rounded-full bg-emerald-500 animate-[ping_1s_ease-out_0.3s_infinite]" style={{opacity:0.3}} />
                  </>
                ) : (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>
              {/* Message */}
              <p className="text-2xl font-black text-center">{toastMsg}</p>
            </div>
          </div>
        )}

        {paymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
            <div className={`w-full max-w-md rounded-[2.5rem] border p-8 shadow-2xl animate-in fade-in zoom-in duration-300 ${isDark ? 'border-white/10 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black italic">{lang === 'vi' ? 'Thanh toán' : 'Checkout'}</h3>
                  <div className="h-1 w-8 bg-orange-500 mt-1 rounded-full" />
                </div>
                <button 
                  onClick={() => setPaymentModalOpen(false)} 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-zinc-100 hover:bg-zinc-200'} text-2xl font-light`}
                >×</button>
              </div>

              {featuredPaymentMethod ? (
                <>
                  <div className="flex justify-center mb-8">
                    <div className="bg-white p-5 rounded-[2.5rem] shadow-xl ring-8 ring-orange-500/10 transition-transform hover:scale-105 duration-500">
                      {featuredPaymentMethod.qrImage ? (
                        <Image src={featuredPaymentMethod.qrImage} alt="QR" width={220} height={220} unoptimized className="object-contain rounded-[1.5rem]" />
                      ) : featuredPaymentMethod.qrContent ? (
                        <QRCodeCanvas value={featuredPaymentMethod.qrContent} size={220} />
                      ) : (
                        <div className="w-[220px] h-[220px] flex items-center justify-center text-zinc-400 italic">No QR available</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className={`rounded-3xl p-5 border ${isDark ? 'bg-white/5 border-white/5' : 'bg-zinc-50 border-zinc-200'}`}>
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-2">{featuredPaymentMethod.bankName || (lang === 'vi' ? 'Tài khoản' : 'Account')}</p>
                      <p className="font-black text-xl tracking-tight leading-none mb-1">{featuredPaymentMethod.accountNumber}</p>
                      <p className="text-sm font-medium opacity-70">{featuredPaymentMethod.accountName}</p>
                    </div>

                    <div className="rounded-3xl bg-linear-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/20">
                      <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">{lang === 'vi' ? 'Tổng tiền cần trả' : 'Total Amount'}</p>
                      <p className="font-black text-3xl tracking-tighter">{formatCurrency(displayGrandTotal)}</p>
                    </div>

                    <p className="text-center text-[11px] opacity-40 font-medium px-4 leading-relaxed">
                      {lang === 'vi' 
                        ? 'Vui lòng thực hiện chuyển khoản với số tiền trên. Sau khi chuyển, hãy báo với nhân viên để được xác nhận.' 
                        : 'Please process the transfer for the amount above. Inform staff after payment for confirmation.'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="text-orange-500" size={32} />
                  </div>
                  <h4 className="text-xl font-bold">{lang === 'vi' ? 'Chưa cấu hình QR' : 'QR Not Configured'}</h4>
                  <p className="text-sm opacity-60 leading-relaxed px-4">
                    {lang === 'vi' 
                      ? 'Nhà hàng chưa cài đặt mã QR thanh toán tự động. Vui lòng gọi nhân viên để được hỗ trợ trực tiếp.' 
                      : 'The restaurant hasn\'t set up a payment QR yet. Please call our staff for assistance.'}
                  </p>
                  <button 
                    onClick={() => setPaymentModalOpen(false)}
                    className="mt-4 w-full py-3 rounded-2xl bg-zinc-800 text-white font-bold text-sm"
                  >
                    {lang === 'vi' ? 'Đã hiểu' : 'Got it'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* mobile footer */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 p-4 border-t border-white/5 lg:hidden flex justify-between items-center backdrop-blur-lg">
            <div>
              <p className="text-xs opacity-50 uppercase tracking-widest">{ui[lang].items}: {displayOrderItemsCount}</p>
              <p className="font-black text-lg">{formatCurrency(displayGrandTotal)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePayNow} disabled={isLoading} className={`bg-emerald-500 text-white px-5 py-2.5 rounded-full font-bold text-xs transition-transform active:scale-95 ${isLoading ? 'opacity-50' : ''}`}>
                {isLoading ? (lang === 'vi' ? 'Đang xử lý...' : 'Processing...') : (lang === 'vi' ? 'Trả tiền' : 'Pay')}
              </button>
              <button disabled={isLoading} onClick={placeOrder} className={`bg-orange-500 text-white px-5 py-2.5 rounded-full font-bold text-xs transition-transform active:scale-95 ${isLoading ? 'opacity-50' : ''}`}>
                {isLoading ? '...' : ui[lang].btn}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1">
          <header className="mb-8">
            <h1 className="text-4xl font-black italic flex items-center gap-2">HCH RESTO <Utensils className="text-orange-500" /></h1>
            {tableInfo && <p className="text-xs font-bold opacity-50 mt-2 uppercase tracking-widest">{ui[lang].table}</p>}
          </header>

          <div className="sticky top-4 z-30 mb-8 bg-zinc-950/50 backdrop-blur-md rounded-full p-2 flex gap-2 overflow-x-auto no-scrollbar border border-white/5">
            {navSections.map(s => (
              <button 
                key={s.id} 
                onClick={() => scrollToSection(s.id)}
                className={`shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all ${activeCategoryId === s.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400'}`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuSections.map(section => (
              <React.Fragment key={section.id}>
                <div id={section.id} ref={el => { sectionRefs.current[section.id] = el; }} className="col-span-1 md:col-span-2 mt-8 mb-2">
                  <h3 className="text-xl font-black border-l-4 border-orange-500 pl-3">{section.name}</h3>
                </div>
                {section.items.map(item => (
                  <div key={item.id} className="p-4 rounded-[2rem] bg-white/5 border border-white/5 flex gap-4">
                    <Image src={item.image} width={100} height={100} unoptimized className="w-24 h-24 rounded-2xl object-cover" alt="" />
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold">{lang === 'vi' ? item.nameVi : (item.nameEn || item.nameVi)}</h4>
                        <p className="text-2xl font-black mt-1">{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getAvailableStock(item.id) > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {getAvailableStock(item.id) > 0 ? (lang === 'vi' ? 'Còn hàng' : 'In stock') : (lang === 'vi' ? 'Hết' : 'Out')}
                        </span>
                        <button onClick={() => addToCart(item.id)} disabled={getAvailableStock(item.id) <= 0} className="bg-orange-500 p-2 rounded-xl text-white disabled:opacity-20"><Plus size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <aside className="hidden lg:block w-[400px]">
          <div className="sticky top-10 p-8 rounded-[3rem] bg-zinc-900 border border-white/10 flex flex-col min-h-[500px]">
            <h2 className="text-2xl font-black italic mb-6">{ui[lang].order}<span className="text-orange-500">.</span></h2>
            
            <div className="flex-1 overflow-y-auto space-y-4">

              {/* ── GIỎ MỚI (chưa gửi bếp) ── */}
              {cartEntries.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest mb-3 text-orange-400/80">
                    {lang === 'vi' ? '🛒 Giỏ mới' : '🛒 New Cart'}
                  </p>
                  {cartEntries.map(([id, qty]) => {
                    const item = menuItems.find(m => m.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} className="flex justify-between items-end mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{lang === 'vi' ? item.nameVi : item.nameEn}</p>
                          <p className="text-orange-500 font-black">{formatCurrency(item.price * qty)}</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                          <button onClick={() => updateQty(id, -1)} className="p-1"><Minus size={14} /></button>
                          <span className="text-xs font-black">{qty}</span>
                          <button onClick={() => updateQty(id, 1)} className="p-1"><Plus size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── ĐÃ GỬI BẾP (đơn đang chờ / đang nấu) ── */}
              {groupedKitchenItems.length > 0 && (
                <div className={`border-t border-white/10 pt-4 ${cartEntries.length > 0 ? 'opacity-80' : ''}`}>
                  <p className="text-[10px] uppercase font-bold tracking-widest mb-3 text-emerald-400/80">
                    {lang === 'vi' ? '✅ Đã gửi bếp' : '✅ Sent to kitchen'}
                  </p>
                  {groupedKitchenItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs mb-1 text-zinc-400">
                      <span>{menuItems.find(m => m.id === item.id)?.nameVi}</span>
                      <span className="font-bold">x{item.qty}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── GIỎ TRỐNG ── */}
              {cartEntries.length === 0 && groupedKitchenItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-5xl mb-4">🍽️</div>
                  <p className="text-zinc-500 font-medium">{lang === 'vi' ? 'Giỏ hàng trống' : 'Cart is empty'}</p>
                  <p className="text-zinc-600 text-xs mt-1">{lang === 'vi' ? 'Chọn món để bắt đầu' : 'Pick items to start'}</p>
                </div>
              )}
            </div>

            {/* ── NÚT HÀNH ĐỘNG ── */}
            {(cartEntries.length > 0 || groupedKitchenItems.length > 0) && (
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              {/* Tổng tiền */}
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs uppercase opacity-50">{ui[lang].total}</span>
                <span className="text-3xl font-black text-orange-500">{formatCurrency(displayGrandTotal)}</span>
              </div>

              {/* Nút Đặt món — SÁNG khi có món mới, TỐI khi đã gửi bếp xong */}
              <button
                disabled={isLoading || cartEntries.length === 0}
                onClick={placeOrder}
                className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                  isLoading
                    ? 'opacity-50 bg-zinc-700 text-zinc-400'
                    : cartEntries.length === 0
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white shadow-orange-950/30 hover:bg-orange-400'
                }`}
              >
                {isLoading
                  ? (lang === 'vi' ? 'ĐANG XỬ LÝ...' : 'PROCESSING...')
                  : cartEntries.length === 0
                  ? (lang === 'vi' ? 'ĐÃ GỬI BẾP' : 'SENT TO KITCHEN')
                  : ui[lang].btn}
              </button>

              {/* Nút Thanh toán */}
              <button
                disabled={isLoading}
                onClick={handlePayNow}
                className={`w-full py-3 rounded-[2rem] font-bold text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                  isLoading
                    ? 'opacity-50 bg-zinc-700 text-zinc-400'
                    : 'bg-emerald-500 text-white shadow-emerald-950/20 hover:bg-emerald-400'
                }`}
              >
                {isLoading
                  ? (lang === 'vi' ? 'ĐANG CHỜ...' : 'WAITING...')
                  : (lang === 'vi' ? 'THANH TOÁN NGAY' : 'PAY NOW')}
              </button>
            </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
