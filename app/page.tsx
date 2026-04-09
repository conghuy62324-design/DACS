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

const readInventoryStock = (): Record<string, InventoryEntry> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem('inventoryStock');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getInventoryQuantity = (entry?: InventoryEntry) => {
  if (!entry) return 0;
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
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);

      // When a customer opens the menu via QR, mark the table as occupied
      const tables = loadTables();
      const next = tables.map(t => {
        if (t.table === info.table && t.floor === info.floor) {
          return { ...t, status: t.status === 'empty' ? 'occupied' : t.status };
        }
        return t;
      });
      saveTables(next);
    }
  }, []);

  // load cart từ localStorage khi mount
  // hydrate cart
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

  useEffect(() => {
    setInventoryStock(readInventoryStock());

    const syncInventory = () => setInventoryStock(readInventoryStock());
    window.addEventListener('storage', syncInventory);
    const interval = window.setInterval(syncInventory, 2000);

    return () => {
      window.removeEventListener('storage', syncInventory);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const syncPaymentMethods = () => {
      setPaymentMethods(readPaymentMethodsFromStorage().filter(method => method.active));
    };

    syncPaymentMethods();
    window.addEventListener('storage', syncPaymentMethods);
    const interval = window.setInterval(syncPaymentMethods, 2000);

    return () => {
      window.removeEventListener('storage', syncPaymentMethods);
      window.clearInterval(interval);
    };
  }, []);

  // fetch menu ban đầu
  // fetch menu and listen for real‑time updates
  const translatedRef = useRef<Record<string, boolean>>({});

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2200);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [menuRes, categoriesRes, ordersRes] = await Promise.all([
          fetch('/api/menu'),
          fetch('/api/categories'),
          fetch('/api/orders')
        ]);
        const menuData: MenuItem[] = await menuRes.json();
        const categoriesData: Category[] = await categoriesRes.json();
        const ordersData: OrderType[] = await ordersRes.json();
        setMenuItems(menuData);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (e) {
        console.error(e);
      }
    };
    load();

    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // tự động dịch khi chuyển sang EN với những món chưa có nameEn / descriptionEn
  useEffect(() => {
    if (lang !== 'en') {
      translatedRef.current = {};
      return;
    }

    const toTranslate: Array<{ id: string; field: 'name' | 'description'; text: string }> = [];

    menuItems.forEach(item => {
      if (item.nameVi?.trim() && !item.nameEn?.trim() && !translatedRef.current[`${item.id}-name`]) {
        toTranslate.push({ id: item.id, field: 'name', text: item.nameVi });
      }
      if (item.descriptionVi?.trim() && !item.descriptionEn?.trim() && !translatedRef.current[`${item.id}-desc`]) {
        toTranslate.push({ id: item.id, field: 'description', text: item.descriptionVi });
      }
    });

    toTranslate.forEach(async ({ id, field, text }) => {
      translatedRef.current[`${id}-${field === 'name' ? 'name' : 'desc'}`] = true;
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, from: 'vi', to: 'en' })
        });
        const data = await res.json();
        const translated = data.translatedText || text;

        setMenuItems(prev => prev.map(item =>
          item.id === id ? { ...item, [field === 'name' ? 'nameEn' : 'descriptionEn']: translated } : item
        ));

        await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, [field === 'name' ? 'nameEn' : 'descriptionEn']: translated })
        });
      } catch (err) {
        console.error('translate error', err);
      }
    });
  }, [lang, menuItems]);

  // panel chỉnh sửa sẽ đóng khi giỏ hàng trống (di chuyển xuống dưới vì cần totalItems)

  // đồng bộ cart vào localStorage mỗi khi thay đổi
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

  // Hàm thêm món
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
    showToast(lang === 'vi' ? 'Đã thêm vào giỏ' : 'Added to cart');
  }, [getAvailableStock, lang, showToast]);

  // Hàm tăng giảm số lượng
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

  // --- LOGIC TÍNH TỔNG TIỀN (FIX TRIỆT ĐỂ) ---
  const cartEntries = Object.entries(cart);
  const totalPrice = cartEntries.reduce((total, [id, qty]) => {
    const item = menuItems.find(m => m.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const totalItems = cartEntries.reduce((total, [, qty]) => total + qty, 0);
  // nếu cart rỗng thì đóng giao diện chỉnh sửa
  useEffect(() => {
    if (totalItems === 0) setMobileCartOpen(false);
  }, [totalItems]);
  // format helper theo ngôn ngữ
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

  const uncategorizedItems = menuItems.filter(item =>
    !categories.some(category => category.id === item.categoryId || category.name === item.categoryName)
  );

  const navSections = useMemo(() => [
    ...menuSections,
    ...(uncategorizedItems.length > 0 ? [{ id: 'uncategorized', name: lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized', icon: '📁' }] : []),
  ], [lang, menuSections, uncategorizedItems.length]);

  const sessionOpenOrders = orders.filter(order =>
    placedOrderIds.includes(order.id) && !isClosedOrderStatus(order.status)
  );

  const tableOpenOrders = tableInfo
    ? orders.filter(order =>
        normalizeSeatValue(order.table) === normalizeSeatValue(tableInfo.table) &&
        normalizeSeatValue(order.floor) === normalizeSeatValue(tableInfo.floor) &&
        !isClosedOrderStatus(order.status)
      )
    : sessionOpenOrders;

  const visibleKitchenOrders = tableOpenOrders.filter(order => {
    const normalized = normalizeOrderWorkflowStatus(order.status);
    return !normalized.includes('nau xong') && !normalized.includes('cooked') && !normalized.includes('phuc vu') && !normalized.includes('served');
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
          if (order.status && !current.statuses.includes(order.status)) {
            current.statuses.push(order.status);
          }
          return;
        }

        grouped.set(item.id, {
          id: item.id,
          qty,
          total: price * qty,
          statuses: order.status ? [order.status] : [],
        });
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
  const tableDueTotal = tableOpenOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const displayGrandTotal = totalPrice + existingOrdersTotal;
  const featuredPaymentMethod = paymentMethods[0] || null;
  const latestOpenOrder = tableOpenOrders[tableOpenOrders.length - 1] || null;

  const canPayNow = tableOpenOrders.length > 0 || totalItems > 0;

  const handlePayNow = async () => {
    if (!featuredPaymentMethod && false) {
      showToast(lang === 'vi' ? 'ChÆ°a cÃ i Ä‘áº·t QR thanh toÃ¡n' : 'Payment QR is not configured', 'error');
      return;
    }

    if (totalItems > 0) {
      const createdOrder = await placeOrder();
      if (createdOrder) {
        if (featuredPaymentMethod) {
          setPaymentModalOpen(true);
        } else {
          openPaymentPage(createdOrder.id);
        }
      }
      return;
    }

    if (tableOpenOrders.length > 0) {
      if (featuredPaymentMethod) {
        setPaymentModalOpen(true);
      } else if (latestOpenOrder) {
        openPaymentPage(latestOpenOrder.id);
      }
      return;
    }
  };

  const openPaymentPage = (orderId: string) => {
    window.open(`/pay/${orderId}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!navSections.length) {
      setActiveCategoryId('');
      return;
    }

    setActiveCategoryId(prev => prev || navSections[0].id);

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry?.target?.id) {
        setActiveCategoryId(visibleEntry.target.id);
      }
    }, {
      rootMargin: '-25% 0px -55% 0px',
      threshold: [0.2, 0.35, 0.5],
    });

    navSections.forEach(section => {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [navSections]);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategoryId(id);
  };

  // nếu đã có thông tin bàn nhưng chưa nhập tên, hiển thị overlay login
  if (tableInfo && (!customerName.trim() || !customerPhone.trim())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 text-white">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-zinc-900/95 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-orange-400">
            {lang === 'vi' ? 'Thông tin bàn' : 'Table check-in'}
          </p>
          <h2 className="mt-3 text-2xl font-black">
            {lang === 'vi' ? 'Xác nhận thông tin' : 'Confirm your details'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {lang === 'vi' ? 'Vui lòng kiểm tra số bàn và nhập thông tin trước khi đặt món.' : 'Please check your table and enter your details before ordering.'}
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                {lang === 'vi' ? 'Số bàn' : 'Table'}
              </p>
              <p className="mt-1 text-lg font-bold">
                {tableInfo.table || '--'}{tableInfo.floor ? ` • ${lang === 'vi' ? `Tầng ${tableInfo.floor}` : `Floor ${tableInfo.floor}`}` : ''}
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                {lang === 'vi' ? 'Tên' : 'Name'}
              </label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500"
                placeholder={lang === 'vi' ? 'Nhập tên của bạn' : 'Enter your name'}
              />
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
              <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                {lang === 'vi' ? 'SĐT' : 'Phone'}
              </label>
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value.replace(/[^\d+\s]/g, ''))}
                inputMode="tel"
                className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500"
                placeholder={lang === 'vi' ? 'Nhập số điện thoại' : 'Enter your phone number'}
              />
            </div>
          </div>

          <button
            disabled={customerName.trim() === '' || customerPhone.trim() === ''}
            onClick={() => {
              const trimmedName = customerName.trim();
              const trimmedPhone = customerPhone.trim();
              const nameKey = `customerName_${tableInfo.table}_${tableInfo.floor}`;
              const phoneKey = `customerPhone_${tableInfo.table}_${tableInfo.floor}`;
              localStorage.setItem(nameKey, trimmedName);
              localStorage.setItem(phoneKey, trimmedPhone);
              setCustomerName(trimmedName);
              setCustomerPhone(trimmedPhone);
            }}
            className="mt-5 w-full rounded-[1.35rem] bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lang === 'vi' ? 'Vào menu' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  if (false && tableInfo && !customerName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">
        <div className="bg-zinc-800 p-8 rounded-xl shadow-lg w-80">
          <h2 className="text-xl font-bold mb-4">
            {lang === 'vi' ? 'Nhập tên' : 'Enter name'}
          </h2>
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full p-2 mb-4 text-black rounded"
            placeholder={lang === 'vi' ? 'Tên của bạn' : 'Your name'}
          />
          <button
            disabled={customerName.trim() === ''}
            onClick={() => {
              const key = tableInfo ? `customerName_${tableInfo.table}_${tableInfo.floor}` : 'customerName';
              const trimmed = customerName.trim();
              localStorage.setItem(key, trimmed);
              setCustomerName(trimmed);
            }}
            className="w-full bg-orange-500 py-2 rounded font-bold hover:bg-orange-600 transition"
          >
            {lang === 'vi' ? 'Xác nhận' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  const loadTables = (): Array<{ id: string; table: string; floor: string; qr: string; active: boolean; status: string }> => {
    try {
      const raw = localStorage.getItem('tables');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveTables = (tables: Array<{ id: string; table: string; floor: string; qr: string; active: boolean; status: string }>) => {
    try {
      localStorage.setItem('tables', JSON.stringify(tables));
    } catch {
      // ignore
    }
  };

  const placeOrder = async () => {
    if (totalItems === 0) return null;
    setIsLoading(true);
    try {
      const payload = { cart, totalPrice, lang, customerName, customerPhone, table: tableInfo?.table, floor: tableInfo?.floor };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          setOrders(prev => [data.order, ...prev.filter(order => order.id !== data.order.id)]);
          setPlacedOrderIds(prev => [data.order.id, ...prev.filter(id => id !== data.order.id)]);
        }
        setCart({});
        localStorage.removeItem('cart');
        showToast(lang === 'vi' ? 'Đặt món thành công' : 'Order placed');

        // mark table as ordering
        if (tableInfo) {
          const tables = loadTables();
          const next = tables.map(t => {
            if (t.table === tableInfo.table && t.floor === tableInfo.floor) {
              return { ...t, status: 'ordering' };
            }
            return t;
          });
          saveTables(next);
        }
        return data?.order ?? null;
      } else {
        throw new Error('bad');
      }
    } catch (e) {
      console.error(e);
      showToast(lang === 'vi' ? 'Lỗi đặt món' : 'Order failed', 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Bộ từ điển dịch thuật
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


  return (
    <div className={`min-h-screen transition-all duration-300 scroll-smooth ${isDark ? 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(180deg,#09090b_0%,#111114_100%)] text-white' : 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.10),_transparent_30%),linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] text-zinc-900'}`} style={{ paddingBottom: displayOrderItemsCount > 0 ? '4rem' : undefined }}>
      <div className="max-w-7xl mx-auto p-4 lg:p-10 flex flex-col lg:flex-row gap-10 font-sans">
        {toastMsg && (
          <div className={`fixed bottom-5 right-5 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl animate-fade-in-out ${
            toastType === 'error'
              ? 'border-red-500/30 bg-red-500/15 text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
          }`}>
            {toastMsg}
          </div>
        )}

        {paymentModalOpen && featuredPaymentMethod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl ${isDark ? 'border-white/10 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                    {lang === 'vi' ? 'Thanh toán ngay' : 'Pay now'}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">{featuredPaymentMethod.bankName || featuredPaymentMethod.providerName || featuredPaymentMethod.name}</h3>
                  <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {lang === 'vi' ? 'Quét mã QR hoặc chuyển khoản theo thông tin bên dưới.' : 'Scan the QR or transfer using the details below.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className={`rounded-2xl px-3 py-2 text-sm font-bold ${isDark ? 'bg-white/5 text-zinc-300 hover:bg-white/10' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                >
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="flex aspect-square w-full max-w-[260px] items-center justify-center rounded-[2rem] bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                  {featuredPaymentMethod.qrImage ? (
                    <Image
                      src={featuredPaymentMethod.qrImage}
                      alt={featuredPaymentMethod.name || 'QR'}
                      width={220}
                      height={220}
                      unoptimized
                      className="h-full w-full rounded-[1.5rem] object-cover"
                    />
                  ) : featuredPaymentMethod.qrContent ? (
                    <QRCodeCanvas value={featuredPaymentMethod.qrContent} size={220} includeMargin />
                  ) : (
                    <div className="text-center text-sm text-zinc-500">{lang === 'vi' ? 'Chưa có mã QR' : 'No QR available'}</div>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className={`rounded-[1.4rem] border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'Số tài khoản' : 'Account number'}</p>
                  <p className="mt-2 break-all text-base font-black">{featuredPaymentMethod.accountNumber || '--'}</p>
                </div>
                <div className={`rounded-[1.4rem] border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'Chủ tài khoản' : 'Account holder'}</p>
                  <p className="mt-2 text-base font-black">{featuredPaymentMethod.accountName || '--'}</p>
                </div>
                <div className={`rounded-[1.4rem] border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">{lang === 'vi' ? 'Tổng cần thanh toán' : 'Amount due'}</p>
                  <p className="mt-2 text-2xl font-black text-emerald-400">{formatCurrency(displayGrandTotal)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* mobile cart editing panel */}
        {mobileCartOpen && (
          <div className="fixed bottom-16 left-0 right-0 bg-zinc-800 p-4 max-h-[50%] overflow-y-auto lg:hidden">
            {cartEntries.length > 0 && (
              <div className="mb-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-400">
                  {lang === 'vi' ? 'Món mới đang chọn' : 'New items'}
                </p>
                {cartEntries.map(([id, qty]) => {
                  const item = menuItems.find(m => m.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between items-center mb-3">
                      <span className="flex-1 text-sm font-medium">
                        {lang === 'vi' ? item.nameVi : item.nameEn}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(id, -1)} className="p-1"><Minus size={14} /></button>
                        <span>{qty}</span>
                        <button onClick={() => updateQty(id, 1)} className="p-1"><Plus size={14} /></button>
                        <button onClick={() => updateQty(id, -qty)} className="p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {groupedKitchenItems.length > 0 && (
              <div className="space-y-3 border-t border-white/10 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                  {lang === 'vi' ? 'Món đã gửi bếp' : 'Sent to kitchen'}
                </p>
                {false && visibleKitchenOrders.map(order => (
                  <div key={`mobile-existing-${order.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">#{order.id}</span>
                      <span className="text-xs text-zinc-300">{order.status || 'Chờ xử lý'}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {order.items.map(item => {
                        const menuItem = menuItems.find(m => m.id === item.id);
                        return (
                          <div key={`mobile-${order.id}-${item.id}`} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-200">{lang === 'vi' ? (menuItem?.nameVi || item.id) : (menuItem?.nameEn || menuItem?.nameVi || item.id)}</span>
                            <span className="font-bold text-cyan-200">x{item.qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groupedKitchenItems.map(item => {
                  const menuItem = menuItems.find(m => m.id === item.id);
                  const statusLabel = item.statuses.length === 1 ? item.statuses[0] : 'Multiple batches';
                  return (
                    <div key={`mobile-grouped-${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{lang === 'vi' ? (menuItem?.nameVi || item.id) : (menuItem?.nameEn || menuItem?.nameVi || item.id)}</span>
                        <span className="text-sm font-black text-emerald-300">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                        <span>{statusLabel || 'Pending'}</span>
                        <span>Merged</span>
                      </div>
                      <div className="mt-3 flex items-center justify-end text-sm">
                        <span className="font-bold text-cyan-200">x{item.qty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              className="mt-2 text-xs underline"
              onClick={() => setMobileCartOpen(false)}
            >
              Đóng
            </button>
          </div>
        )}

        {/* mobile sticky footer */}
        {displayOrderItemsCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 text-white p-3 flex justify-between items-center lg:hidden">
            <div className="flex flex-col">
              <span className="text-xs uppercase opacity-70">
                {ui[lang].items}: {displayOrderItemsCount}
              </span>
              <span className="font-bold">{totalItems > 0 ? formatCurrency(totalPrice) : (lang === 'vi' ? 'Đang có món đã gửi bếp' : 'Existing kitchen orders')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileCartOpen(!mobileCartOpen)}
                className="text-xs underline"
              >
                {lang === 'vi' ? 'Đơn hàng' : 'Order'}
              </button>
              <button
                onClick={handlePayNow}
                disabled={!canPayNow}
                className="bg-emerald-500 px-4 py-2 rounded-full font-black text-sm uppercase tracking-[0.1em] disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {lang === 'vi' ? 'Thanh toán' : 'Pay'}
              </button>
                <button
                  onClick={placeOrder}
                  disabled={totalItems === 0 || isLoading}
                  className="bg-orange-500 px-4 py-2 rounded-full font-black text-sm uppercase tracking-[0.1em] disabled:bg-zinc-800 disabled:text-zinc-600 flex items-center"
                >
                  {isLoading ? (
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-r-transparent animate-spin" />
                  ) : (
                    visibleKitchenOrders.length > 0
                      ? (lang === 'vi' ? 'Gửi món mới' : 'Send new')
                      : ui[lang].btn
                  )}
                </button>
            </div>
          </div>
        )}

        {/* CỘT TRÁI: MENU */}
        <div className="flex-1">
          <header className={`mb-6 rounded-[2rem] border p-5 lg:p-7 backdrop-blur-xl ${isDark ? 'bg-white/[0.03] border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.35)]' : 'bg-white/80 border-white shadow-[0_20px_80px_rgba(249,115,22,0.12)]'}`}>
            <div className="flex justify-between items-start gap-6 mb-6">
            <div>
              <h1 className="text-3xl lg:text-5xl font-black italic flex items-center gap-3 tracking-tight">HCH RESTO <Utensils className="text-orange-500" /></h1>
              <p className={`mt-3 max-w-2xl text-sm lg:text-base ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {lang === 'vi' ? 'Chạm danh mục bên dưới để nhảy nhanh đến nhóm món tương ứng.' : 'Tap the category rail below to jump smoothly to that section.'}
              </p>
              {tableInfo && (
                <p className="text-[10px] font-bold opacity-50 tracking-[0.2em] mt-3 uppercase italic">
                  {ui[lang].table}
                </p>
              )}
              {false && tableOpenOrders.length > 0 && (
                <div className={`mt-4 rounded-[1.5rem] border p-4 ${isDark ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                        {lang === 'vi' ? 'Thanh toán tự động' : 'Payment ready'}
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {lang === 'vi'
                          ? `Bàn này đang có ${tableOpenOrders.length} bill chưa thanh toán, tổng cần thu ${formatCurrency(tableDueTotal)}`
                          : `${tableOpenOrders.length} unpaid bills for this table, total due ${formatCurrency(tableDueTotal)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPaymentPage(tableOpenOrders[tableOpenOrders.length - 1].id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-cyan-400"
                    >
                      <CreditCard size={16} />
                      {lang === 'vi' ? 'Thanh toán ngay' : 'Pay now'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Nút đổi ngôn ngữ Anh - Việt */}
              <div className="flex bg-zinc-800 rounded-xl p-1 border border-white/5">
                <button onClick={() => setLang('vi')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'vi' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}>VI</button>
                <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? 'bg-orange-500 text-white shadow-lg' : 'text-zinc-500'}`}>EN</button>
              </div>

              {/* Nút đổi màu nền */}
              <button onClick={() => setIsDark(!isDark)} className={`p-2.5 rounded-2xl border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 text-orange-400' : 'bg-white border-zinc-200 text-zinc-900 shadow-sm'}`}>
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            </div>
          </header>

          {navSections.length > 0 && (
            <div className="sticky top-3 z-40 mb-10">
              <div className={`rounded-[1.75rem] border px-3 py-3 backdrop-blur-xl ${isDark ? 'border-white/10 bg-zinc-950/75 shadow-[0_20px_60px_rgba(0,0,0,0.35)]' : 'border-orange-100 bg-white/85 shadow-[0_20px_60px_rgba(249,115,22,0.12)]'}`}>
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {navSections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                      activeCategoryId === section.id
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                        : isDark
                          ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {isImageLikeCategoryIcon(section.icon) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={section.icon} alt={section.name} className="mr-2 inline-block h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="mr-2">{section.icon}</span>
                    )}
                    {section.name}
                  </button>
                ))}
                </div>
              </div>
            </div>
          )}

          <h2 className="text-2xl font-black mb-8 italic">{ui[lang].header}<span className="text-orange-500">.</span></h2>

          {menuItems.length === 0 && (
            <div className={`rounded-[2rem] border p-8 mb-8 ${isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-white/80 border-zinc-200 text-zinc-600'}`}>
              <p className="text-lg font-bold mb-2">{lang === 'vi' ? 'Menu đang trống' : 'Menu is empty'}</p>
              <p>{lang === 'vi' ? 'Nhân viên sẽ thêm món từ trang admin. Khi có sản phẩm mới, menu này sẽ tự cập nhật.' : 'Staff can add dishes from admin and this menu will update automatically.'}</p>
            </div>
          )}
          
          <div className="space-y-10">
            {menuSections.map(section => (
              <section key={section.id} id={section.id} ref={node => { sectionRefs.current[section.id] = node; }} className="space-y-4 scroll-mt-52">
                <div className="flex items-center gap-3">
                  {isImageLikeCategoryIcon(section.icon) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={section.icon} alt={section.name} className="h-10 w-10 rounded-2xl object-cover" />
                  ) : (
                    <span className="text-2xl">{section.icon}</span>
                  )}
                  <h3 className="text-xl font-black">{section.name}</h3>
                </div>
                {section.items.length === 0 ? (
                  <p className="text-sm opacity-50">{lang === 'vi' ? 'Danh mục này chưa có món.' : 'No items in this category yet.'}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {section.items.map((item) => (
                      <div key={item.id} className={`p-5 rounded-[2.5rem] border flex gap-5 transition-all hover:scale-[1.02] ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-xl'}`}>
                        <Image src={item.image} width={96} height={96} unoptimized className="w-24 h-24 lg:w-32 lg:h-32 rounded-[2rem] object-cover shadow-2xl" alt="food" />
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <h4 className="font-bold text-lg lg:text-xl leading-tight">{lang === 'vi' ? item.nameVi : (item.nameEn || item.nameVi)}</h4>
                            {((lang === 'vi' ? item.descriptionVi : item.descriptionEn) || '').trim() ? (
                              <p className="text-sm text-zinc-300 mt-1">{lang === 'vi' ? item.descriptionVi : item.descriptionEn}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-orange-500 text-[10px] font-bold tracking-widest uppercase">★ {item.rating} • {ui[lang].prepTime}</p>
                              {getAvailableStock(item.id) <= 0 && (
                                <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
                                  {lang === 'vi' ? 'Hết hàng' : 'Out of stock'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="font-black text-2xl tracking-tighter">{formatCurrency(item.price)}</span>
                            <button onClick={() => addToCart(item.id)} className={`${getAvailableStock(item.id) <= 0 ? 'bg-zinc-700 text-zinc-400 shadow-none' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/30'} p-3.5 rounded-2xl active:scale-90 transition-all`}>
                              <Plus size={20} strokeWidth={4} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {uncategorizedItems.length > 0 && (
              <section id="uncategorized" ref={node => { sectionRefs.current.uncategorized = node; }} className="space-y-4 scroll-mt-52">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <h3 className="text-xl font-black">{lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized'}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {uncategorizedItems.map((item) => (
                    <div key={item.id} className={`p-5 rounded-[2.5rem] border flex gap-5 transition-all hover:scale-[1.02] ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-xl'}`}>
                      <Image src={item.image} width={96} height={96} unoptimized className="w-24 h-24 lg:w-32 lg:h-32 rounded-[2rem] object-cover shadow-2xl" alt="food" />
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h4 className="font-bold text-lg lg:text-xl leading-tight">{lang === 'vi' ? item.nameVi : (item.nameEn || item.nameVi)}</h4>
                          {((lang === 'vi' ? item.descriptionVi : item.descriptionEn) || '').trim() ? (
                            <p className="text-sm text-zinc-300 mt-1">{lang === 'vi' ? item.descriptionVi : item.descriptionEn}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="text-orange-500 text-[10px] font-bold tracking-widest uppercase">★ {item.rating} • {ui[lang].prepTime}</p>
                            {getAvailableStock(item.id) <= 0 && (
                              <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
                                {lang === 'vi' ? 'Hết hàng' : 'Out of stock'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="font-black text-2xl tracking-tighter">{formatCurrency(item.price)}</span>
                          <button onClick={() => addToCart(item.id)} className={`${getAvailableStock(item.id) <= 0 ? 'bg-zinc-700 text-zinc-400 shadow-none' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-500/30'} p-3.5 rounded-2xl active:scale-90 transition-all`}>
                            <Plus size={20} strokeWidth={4} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT ĐƠN HÀNG (ẩn trên mobile) */}
        <aside className="hidden lg:block w-full lg:w-[420px]">
          <div className={`p-8 rounded-[3.5rem] shadow-2xl flex flex-col min-h-[600px] sticky top-10 border transition-all ${isDark ? 'bg-zinc-900 border-white/5 text-white' : 'bg-zinc-800 border-zinc-700 text-white'}`}>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black italic">{ui[lang].order}<span className="text-orange-500 text-4xl">.</span></h2>
              <div className="bg-orange-500 px-3 py-1 rounded-full text-[10px] font-black">{displayOrderItemsCount} {ui[lang].items}</div>
            </div>

            {false && tableOpenOrders.length > 0 && (
              <div className="mb-6 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-300">
                    {lang === 'vi' ? 'Mục thanh toán' : 'Payment section'}
                  </p>
                  <p className="mt-2 text-lg font-black text-white">{formatCurrency(tableDueTotal)}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    {lang === 'vi' ? `${tableOpenOrders.length} bill đang mở cho bàn này` : `${tableOpenOrders.length} open bills for this table`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openPaymentPage(tableOpenOrders[tableOpenOrders.length - 1].id)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-cyan-400"
                >
                  <CreditCard size={16} />
                  {lang === 'vi' ? 'Thanh toán ngay' : 'Pay now'}
                </button>
                <div className="mt-4 space-y-2">
                  {tableOpenOrders.map(order => (
                    <button
                      key={`pay-${order.id}`}
                      type="button"
                      onClick={() => openPaymentPage(order.id)}
                      className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-black/30"
                    >
                      <span>
                        <span className="block text-sm font-bold text-white">#{order.id}</span>
                        <span className="mt-1 block text-xs text-zinc-300">{order.status || 'Chờ xử lý'}</span>
                      </span>
                      <span className="text-sm font-black text-orange-300">{formatCurrency(order.total || 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
              {cartEntries.length === 0 && visibleKitchenOrders.length === 0 ? (
                <div className="opacity-20 text-center py-24 italic text-sm font-medium tracking-widest uppercase">{ui[lang].empty}</div>
              ) : (
                <>
                  {cartEntries.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-400">
                          {lang === 'vi' ? 'Món mới đang chọn' : 'New items'}
                        </p>
                        <span className="rounded-full bg-orange-500/15 px-3 py-1 text-[10px] font-black text-orange-300">
                          {totalItems} {ui[lang].items}
                        </span>
                      </div>
                      {cartEntries.map(([id, qty]) => {
                        const item = menuItems.find(m => m.id === id);
                        if (!item) return null;
                        return (
                          <div key={id} className="flex justify-between items-center animate-in slide-in-from-right-3 duration-300">
                            <div className="flex-1">
                              <p className="font-bold text-sm leading-tight text-zinc-100">{lang === 'vi' ? item.nameVi : item.nameEn}</p>
                              <p className="text-orange-500 font-black text-xs mt-1">{formatCurrency(item.price * qty)}</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
                              <button onClick={() => updateQty(id, -1)} className="hover:text-orange-500 p-1"><Minus size={14} /></button>
                              <span className="font-black text-sm w-5 text-center">{qty}</span>
                              <button onClick={() => updateQty(id, 1)} className="hover:text-orange-500 p-1"><Plus size={14} /></button>
                              <button onClick={() => updateQty(id, -qty)} className="ml-1 text-zinc-600 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {groupedKitchenItems.length > 0 && (
                    <div className="space-y-4 border-t border-white/10 pt-6">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-300">
                          {lang === 'vi' ? 'Món đã gửi bếp' : 'Sent to kitchen'}
                        </p>
                        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-[10px] font-black text-cyan-200">
                          {existingOrderItemsCount} {ui[lang].items}
                        </span>
                      </div>
                      {false && visibleKitchenOrders.map(order => (
                        <div key={`existing-${order.id}`} className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-white">#{order.id}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400">{order.status || 'Chờ xử lý'}</p>
                            </div>
                            <p className="text-sm font-black text-emerald-300">{formatCurrency(order.total || 0)}</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {order.items.map(item => {
                              const menuItem = menuItems.find(m => m.id === item.id);
                              return (
                                <div key={`${order.id}-${item.id}`} className="flex items-center justify-between text-sm">
                                  <span className="text-zinc-200">{lang === 'vi' ? (menuItem?.nameVi || item.id) : (menuItem?.nameEn || menuItem?.nameVi || item.id)}</span>
                                  <span className="font-bold text-cyan-200">x{item.qty}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {groupedKitchenItems.map(item => {
                        const menuItem = menuItems.find(m => m.id === item.id);
                        const statusLabel = item.statuses.length === 1 ? item.statuses[0] : 'Multiple batches';
                        return (
                          <div key={`existing-grouped-${item.id}`} className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-white">{lang === 'vi' ? (menuItem?.nameVi || item.id) : (menuItem?.nameEn || menuItem?.nameVi || item.id)}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400">{statusLabel || 'Pending'}</p>
                              </div>
                              <p className="text-sm font-black text-emerald-300">{formatCurrency(item.total)}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                              <span className="text-zinc-400">Auto merged</span>
                              <span className="font-bold text-cyan-200">x{item.qty}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-10 pt-10 border-t border-white/10">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.3em] block mb-1">{ui[lang].total}</span>
                  <span className="text-4xl font-black text-orange-500 tracking-tighter drop-shadow-lg">
                    {formatCurrency(displayGrandTotal)}
                  </span>
                </div>
              </div>
              <div className="grid gap-3">
                <button
                  disabled={!canPayNow}
                  onClick={handlePayNow}
                  className="order-2 w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-700 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-emerald-900/40 active:scale-95 transition-all flex justify-center items-center"
                >
                  {lang === 'vi' ? 'THANH TOÁN NGAY' : 'PAY NOW'}
                </button>
                <button
                  disabled={totalItems === 0 || isLoading}
                  onClick={placeOrder}
                  className="order-1 w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-700 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-orange-900/50 active:scale-95 transition-all flex justify-center items-center"
                >
                  {isLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                  ) : (
                    totalItems > 0 && visibleKitchenOrders.length > 0
                      ? (lang === 'vi' ? 'GỬI MÓN MỚI VÀO BẾP' : 'SEND NEW ITEMS')
                      : ui[lang].btn
                  )}
                </button>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
