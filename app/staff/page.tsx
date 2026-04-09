
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { LogOut, Minus, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react';
import { isClosedOrderStatus, normalizeSeatValue, updateInventoryForPaidOrder, updateTableStatusInStorage } from '@/lib/payment-client';

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

interface StaffSession {
  sub: string;
  username: string;
  role: string;
  name: string;
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

interface TableInfo {
  table: string;
  floor: string;
}

type ContextMode = 'order' | 'table';

type TableStorageItem = {
  id: string;
  table: string;
  floor: string;
  qr: string;
  active: boolean;
  status: string;
};

const isImageLikeCategoryIcon = (value?: string) =>
  Boolean(value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/') || value.startsWith('/')));

const readInventoryStock = (): Record<string, InventoryEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('inventoryStock');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getInventoryQuantity = (entry?: InventoryEntry) => (entry ? entry.initial + entry.incoming - entry.sold : 0);

const loadTables = (): TableStorageItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('tables');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveTables = (tables: TableStorageItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('tables', JSON.stringify(tables));
  } catch {}
};

export default function StaffOrderPage() {
  const lang = 'vi' as const;
  const [isDark, setIsDark] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventoryStock, setInventoryStock] = useState<Record<string, InventoryEntry>>({});
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showOrderInfoModal, setShowOrderInfoModal] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>('order');
  const [tableInfo, setTableInfo] = useState<TableInfo>({ table: '', floor: '' });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [linkedOrderIds, setLinkedOrderIds] = useState<string[]>([]);
  const [historyItems, setHistoryItems] = useState<Record<string, number>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const translatedRef = useRef<Record<string, boolean>>({});
  const draftKey = staffSession ? `staffOrderDraft_${staffSession.sub}` : '';

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2200);
  }, []);

  const syncTableStatus = useCallback((status: string) => {
    if (!tableInfo.table || !tableInfo.floor) return;
    saveTables(loadTables().map(item => {
      if (
        normalizeSeatValue(item.table) === normalizeSeatValue(tableInfo.table) &&
        normalizeSeatValue(item.floor) === normalizeSeatValue(tableInfo.floor)
      ) {
        if (status === 'occupied' && item.status !== 'empty') return item;
        return { ...item, status };
      }
      return item;
    }));
  }, [tableInfo.floor, tableInfo.table]);

  useEffect(() => {
    const rawCart = localStorage.getItem('staffCart');
    if (!rawCart) return;
    try {
      setCart(JSON.parse(rawCart));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('staffCart', JSON.stringify(cart));
  }, [cart]);

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
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
          setStaffSession(null);
          return;
        }
        const data = await res.json();
        setStaffSession(data?.session?.role === 'staff' ? data.session : null);
      } catch {
        setStaffSession(null);
      } finally {
        setAuthChecking(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setShowOrderInfoModal(false);
        return;
      }
      const draft = JSON.parse(raw) as { table?: string; floor?: string; customerName?: string; customerPhone?: string; contextMode?: ContextMode };
      setTableInfo({ table: String(draft.table || ''), floor: String(draft.floor || '') });
      setCustomerName(String(draft.customerName || ''));
      setCustomerPhone(String(draft.customerPhone || ''));
      setContextMode(draft.contextMode === 'table' ? 'table' : 'order');
      setShowOrderInfoModal(false);
    } catch {
      setShowOrderInfoModal(false);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify({ table: tableInfo.table, floor: tableInfo.floor, customerName, customerPhone, contextMode }));
  }, [contextMode, customerName, customerPhone, draftKey, tableInfo.floor, tableInfo.table]);

  useEffect(() => {
    const load = async () => {
      try {
        const [menuRes, categoriesRes, ordersRes] = await Promise.all([fetch('/api/menu'), fetch('/api/categories'), fetch('/api/orders')]);
        const menuData: MenuItem[] = await menuRes.json();
        const categoriesData: Category[] = await categoriesRes.json();
        const ordersData: OrderType[] = await ordersRes.json();
        setMenuItems(Array.isArray(menuData) ? menuData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (error) {
        console.error(error);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lang !== 'en') {
      translatedRef.current = {};
      return;
    }
    const toTranslate: Array<{ id: string; field: 'name' | 'description'; text: string }> = [];
    menuItems.forEach(item => {
      if (item.nameVi?.trim() && !item.nameEn?.trim() && !translatedRef.current[`${item.id}-name`]) toTranslate.push({ id: item.id, field: 'name', text: item.nameVi });
      if (item.descriptionVi?.trim() && !item.descriptionEn?.trim() && !translatedRef.current[`${item.id}-desc`]) toTranslate.push({ id: item.id, field: 'description', text: item.descriptionVi });
    });
    toTranslate.forEach(async ({ id, field, text }) => {
      translatedRef.current[`${id}-${field === 'name' ? 'name' : 'desc'}`] = true;
      try {
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, from: 'vi', to: 'en' }) });
        const data = await res.json();
        const translated = data.translatedText || text;
        setMenuItems(prev => prev.map(item => item.id === id ? { ...item, [field === 'name' ? 'nameEn' : 'descriptionEn']: translated } : item));
        await fetch('/api/menu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [field === 'name' ? 'nameEn' : 'descriptionEn']: translated }) });
      } catch (error) {
        console.error('translate error', error);
      }
    });
  }, [lang, menuItems]);
  const getAvailableStock = useCallback((id: string) => getInventoryQuantity(inventoryStock[id]), [inventoryStock]);

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
      showToast('Món này hiện đã hết hàng', 'error');
      return;
    }
    setCart(prev => ({ ...prev, [id]: Math.min((prev[id] || 0) + 1, available) }));
    showToast('Đã thêm vào giỏ');
  }, [getAvailableStock, showToast]);

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
    const item = menuItems.find(menuItem => menuItem.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);
  const totalItems = cartEntries.reduce((total, [, qty]) => total + qty, 0);
  const hasOrderInfo = Boolean(
    tableInfo.table.trim() &&
    tableInfo.floor.trim() &&
    customerName.trim() &&
    (customerPhone.trim() || contextMode === 'table')
  );

  const resetCurrentContext = useCallback(() => {
    setTableInfo({ table: '', floor: '' });
    setCustomerName('');
    setCustomerPhone('');
    setLinkedOrderIds([]);
    setHistoryItems({});
    setCart({});
    setContextMode('order');
    localStorage.removeItem('staffCart');
    if (draftKey) localStorage.removeItem(draftKey);
  }, [draftKey]);

  useEffect(() => {
    const table = tableInfo.table.trim();
    const floor = tableInfo.floor.trim();

    if (!table || !floor) {
      setLinkedOrderIds([]);
      setHistoryItems({});
      return;
    }

    if (contextMode !== 'table') {
      setLinkedOrderIds([]);
      setHistoryItems({});
      return;
    }

    const matchedOrders = orders.filter(order =>
      normalizeSeatValue(order.table) === normalizeSeatValue(table) &&
      normalizeSeatValue(order.floor) === normalizeSeatValue(floor) &&
      !isClosedOrderStatus(order.status)
    );

    if (!matchedOrders.length) {
      resetCurrentContext();
      return;
    }

    const mergedHistory = matchedOrders.reduce<Record<string, number>>((acc, order) => {
      order.items.forEach(item => {
        acc[item.id] = (acc[item.id] || 0) + Number(item.qty || 0);
      });
      return acc;
    }, {});

    const nextIds = matchedOrders.map(order => order.id);
    setLinkedOrderIds(prev => (prev.join('|') === nextIds.join('|') ? prev : nextIds));
    setHistoryItems(prev => (JSON.stringify(prev) === JSON.stringify(mergedHistory) ? prev : mergedHistory));
    setCustomerName(current => current.trim() || matchedOrders[0].customer || '');
  }, [contextMode, orders, resetCurrentContext, tableInfo.floor, tableInfo.table]);

  useEffect(() => {
    const tables = loadTables();
    if (!tables.length) return;

    const nextTables = tables.map(table => {
      const hasOpenOrders = orders.some(order =>
        normalizeSeatValue(order.table) === normalizeSeatValue(table.table) &&
        normalizeSeatValue(order.floor) === normalizeSeatValue(table.floor) &&
        !isClosedOrderStatus(order.status)
      );
      const hasClosedOrders = orders.some(order =>
        normalizeSeatValue(order.table) === normalizeSeatValue(table.table) &&
        normalizeSeatValue(order.floor) === normalizeSeatValue(table.floor) &&
        isClosedOrderStatus(order.status)
      );

      if (hasOpenOrders) {
        return table.status === 'ordering' ? table : { ...table, status: 'ordering' };
      }

      if (hasClosedOrders && table.status !== 'empty') {
        return { ...table, status: 'empty' };
      }

      return table;
    });

    if (JSON.stringify(nextTables) !== JSON.stringify(tables)) {
      saveTables(nextTables);
    }
  }, [orders]);

  useEffect(() => {
    if (totalItems === 0) setMobileCartOpen(false);
  }, [totalItems]);

  const formatCurrency = (value: number | string) =>
    Number(value || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const menuSections = useMemo(() => categories
    .map(category => ({ ...category, items: menuItems.filter(item => item.categoryId === category.id || item.categoryName === category.name) }))
    .filter(section => section.items.length > 0), [categories, menuItems]);
  const uncategorizedItems = useMemo(() => menuItems.filter(item => !categories.some(category => category.id === item.categoryId || category.name === item.categoryName)), [categories, menuItems]);
  const navSections = useMemo(() => [...menuSections, ...(uncategorizedItems.length ? [{ id: 'uncategorized', name: 'Chưa phân loại', icon: '📁' }] : [])], [menuSections, uncategorizedItems]);
  const linkedOrders = useMemo(() => orders.filter(order => linkedOrderIds.includes(order.id)), [linkedOrderIds, orders]);
  const paymentOrders = useMemo(() => {
    if (!tableInfo.table.trim() || !tableInfo.floor.trim()) return [];

    return orders.filter(order =>
      normalizeSeatValue(order.table) === normalizeSeatValue(tableInfo.table) &&
      normalizeSeatValue(order.floor) === normalizeSeatValue(tableInfo.floor) &&
      !isClosedOrderStatus(order.status)
    );
  }, [orders, tableInfo.floor, tableInfo.table]);
  const paymentTotal = useMemo(() => paymentOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), [paymentOrders]);
  const historyEntries = useMemo(() => Object.entries(historyItems), [historyItems]);

  const openPaymentPage = useCallback((orderId: string) => {
    window.open(`/pay/${orderId}`, '_blank', 'noopener,noreferrer');
  }, []);

  const payOrderNow = useCallback(async (order: OrderType) => {
    try {
      const paidStatus = 'Đã thanh toán';
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: paidStatus }),
      });

      if (!res.ok) throw new Error('pay failed');

      updateInventoryForPaidOrder(order);
      updateTableStatusInStorage(order.table, order.floor, 'empty');
      setOrders(current => current.map(item => (item.id === order.id ? { ...item, status: paidStatus } : item)));
      showToast(`Đã thanh toán đơn #${order.id}`);
    } catch (error) {
      console.error(error);
      showToast(`Không thể thanh toán đơn #${order.id}`, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (!navSections.length) {
      setActiveCategoryId('');
      return;
    }
    setActiveCategoryId(prev => prev || navSections[0].id);
    const observer = new IntersectionObserver(entries => {
      const visibleEntry = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visibleEntry?.target?.id) setActiveCategoryId(visibleEntry.target.id);
    }, { rootMargin: '-25% 0px -55% 0px', threshold: [0.2, 0.35, 0.5] });
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword, role: 'staff' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed');
        return;
      }
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) {
        setAuthError('Không thể lấy phiên đăng nhập.');
        return;
      }
      const sessionData = await sessionRes.json();
      if (sessionData?.session?.role !== 'staff') {
        setAuthError('Tài khoản này không có quyền order.');
        await fetch('/api/auth/logout', { method: 'POST' });
        return;
      }
      setStaffSession(sessionData.session);
      setLoginPassword('');
    } catch {
      setAuthError('Không thể đăng nhập nhân viên.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    resetCurrentContext();
    setStaffSession(null);
  };

  const placeOrder = async () => {
    if (!staffSession || totalItems === 0 || !hasOrderInfo) {
      if (!hasOrderInfo) setShowOrderInfoModal(true);
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        total: totalPrice,
        totalPrice,
        lang,
        customerName,
        customerPhone,
        table: tableInfo.table,
        floor: tableInfo.floor,
        handler: staffSession.name || staffSession.username,
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          cart,
        }),
      });
      if (!res.ok) throw new Error('bad');
      syncTableStatus('ordering');
      await (async () => {
        try {
          const ordersRes = await fetch('/api/orders');
          const ordersData: OrderType[] = await ordersRes.json();
          setOrders(Array.isArray(ordersData) ? ordersData : []);
        } catch {}
      })();
      setCart({});
      localStorage.removeItem('staffCart');
      showToast(contextMode === 'table' ? 'Đã gửi món mới xuống bếp cho bàn này' : 'Đã gửi order cho bếp');
    } catch (error) {
      console.error(error);
      showToast('Lỗi đặt món', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmOrderInfo = () => {
    if (!hasOrderInfo) return;
    if (contextMode === 'order') {
      setLinkedOrderIds([]);
      setHistoryItems({});
      setCart({});
      localStorage.removeItem('staffCart');
    }
    syncTableStatus('occupied');
    setShowOrderInfoModal(false);
  };

  const ui = {
    authTitle: 'Đăng nhập nhân viên order',
    authDesc: 'Dùng tài khoản nhân viên đã tạo trong trang admin để nhận order trực tiếp tại bàn.',
    header: 'Menu order tại bàn',
    order: 'Phiếu order',
    total: 'Tổng tiền',
    btn: 'Gửi order',
    empty: 'Giỏ hàng đang trống',
    items: 'món',
    prepTime: '15 phút',
    tableLabel: 'Bàn',
    floorLabel: 'Tầng',
    customerLabel: 'Tên khách',
    phoneLabel: 'SĐT',
    confirmInfo: 'Vào menu',
    orderMode: 'Order',
    tableMode: 'Bàn',
    closeInfo: 'Thoát',
    currentOrder: 'Đơn đang lên',
    placedBy: 'Nhân viên phụ trách',
    logout: 'Đăng xuất',
    linkedOrder: 'Đơn đang nối',
  } as const;
  const renderMenuCard = (item: MenuItem) => (
    <div
      key={item.id}
      className={`group relative overflow-hidden rounded-[2rem] border p-4 transition-all duration-200 hover:-translate-y-1 ${
        isDark ? 'border-white/10 bg-zinc-900/90 shadow-[0_20px_50px_rgba(0,0,0,0.22)]' : 'border-white bg-white/90 shadow-[0_20px_50px_rgba(249,115,22,0.12)]'
      }`}
    >
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <Image src={item.image} width={112} height={112} unoptimized className="h-24 w-24 rounded-[1.5rem] object-cover shadow-xl lg:h-28 lg:w-28" alt={item.nameVi} />
          {(cart[item.id] || 0) > 0 && (
            <span className="absolute -right-2 -top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-black text-white shadow-lg shadow-orange-500/30">
              {cart[item.id]}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-black leading-tight lg:text-[1.35rem]">{item.nameVi}</h4>
          {(item.descriptionVi || '').trim() ? <p className={`mt-1 line-clamp-2 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{item.descriptionVi}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">★ {item.rating} • {ui.prepTime}</p>
            {getAvailableStock(item.id) <= 0 && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">Hết hàng</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Giá bán</p>
          <span className="mt-1 block text-2xl font-black tracking-tight text-orange-500">{formatCurrency(item.price)}</span>
        </div>
        <button
          onClick={() => addToCart(item.id)}
          disabled={getAvailableStock(item.id) <= 0}
          className={`inline-flex items-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-black transition-all active:scale-95 ${
            getAvailableStock(item.id) <= 0 ? 'cursor-not-allowed bg-zinc-800 text-zinc-500' : 'bg-orange-500 text-white shadow-xl shadow-orange-500/25 hover:bg-orange-400'
          }`}
        >
          <Plus size={18} strokeWidth={3} />
          Thêm
        </button>
      </div>
    </div>
  );

  const renderCategoryIcon = (icon: string, label: string, className: string) => (
    isImageLikeCategoryIcon(icon)
      ? <Image src={icon} alt={label} width={40} height={40} unoptimized className={className} />
      : <span className={className}>{icon}</span>
  );

  const panelClass = isDark ? 'border-white/10 bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.28)]' : 'border-white bg-white/80 shadow-[0_20px_80px_rgba(249,115,22,0.12)]';
  const summaryCardClass = `rounded-[1.6rem] border p-4 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-orange-100 bg-white/75'}`;

  if (authChecking) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">Đang kiểm tra đăng nhập nhân viên...</div>;
  }

  if (!staffSession) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(180deg,#0a0a0b_0%,#111114_100%)] p-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
          <div className="grid w-full overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-950/95 shadow-[0_32px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="hidden border-r border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-10 lg:flex lg:flex-col lg:justify-between">
              <div>
                <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">HCH Staff Order</span>
                <h1 className="mt-6 text-4xl font-black leading-tight text-white">{ui.header}</h1>
                <p className="mt-4 max-w-md text-base text-zinc-400">{ui.authDesc}</p>
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Đường dẫn</p>
                  <p className="mt-2 text-lg font-semibold text-white">/staff hoặc /order</p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
                  Nhân viên đăng nhập, chọn đúng bàn của khách và tiếp tục order ngay trên cùng một phiếu.
                </div>
              </div>
            </div>
            <div className="p-8 lg:p-10">
              <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">Đăng nhập nhân viên</span>
              <h2 className="mt-5 text-3xl font-black text-white">{ui.authTitle}</h2>
              <p className="mt-3 text-sm text-zinc-400">{ui.authDesc}</p>
              {authError && <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{authError}</div>}
              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-200">Tên đăng nhập</label>
                  <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} autoComplete="username" className="w-full rounded-2xl border border-zinc-700 bg-black/40 px-4 py-4 text-white outline-none transition focus:border-orange-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-200">Mật khẩu</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-2xl border border-zinc-700 bg-black/40 px-4 py-4 text-white outline-none transition focus:border-orange-500" />
                </div>
                <button type="submit" disabled={isLoggingIn} className="w-full rounded-2xl bg-orange-500 px-4 py-4 font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoggingIn ? 'Đang đăng nhập...' : ui.authTitle}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`min-h-screen scroll-smooth transition-all duration-300 ${
        isDark ? 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(180deg,#09090b_0%,#111114_100%)] text-white' : 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.10),_transparent_30%),linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] text-zinc-900'
      }`}
      style={{ paddingBottom: totalItems > 0 ? '4rem' : undefined }}
    >
      {toastMsg && (
        <div className={`fixed bottom-5 right-5 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl ${toastType === 'error' ? 'border-red-500/30 bg-red-500/15 text-red-300' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'}`}>
          {toastMsg}
        </div>
      )}

      {showOrderInfoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-900/95 p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <p className="text-[11px] uppercase tracking-[0.3em] text-orange-400">{contextMode === 'table' ? 'Chọn bàn đang phục vụ' : 'Tạo order mới'}</p>
            <h2 className="mt-3 text-2xl font-black">{contextMode === 'table' ? 'Mở lại đơn theo bàn' : 'Nhập bàn và khách'}</h2>
            <p className="mt-2 text-sm text-zinc-400">{contextMode === 'table' ? 'Chọn đúng bàn đã có khách order để xem lại đơn cũ và gọi tiếp món mới.' : 'Nhập bàn, tầng và thông tin khách để bắt đầu một phiếu order mới.'}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
                <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{ui.tableLabel}</label>
                <input value={tableInfo.table} onChange={e => setTableInfo(prev => ({ ...prev, table: e.target.value }))} className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500" placeholder="Ví dụ 05" />
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3">
                <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{ui.floorLabel}</label>
                <input value={tableInfo.floor} onChange={e => setTableInfo(prev => ({ ...prev, floor: e.target.value }))} className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500" placeholder="1" />
              </div>
              {contextMode !== 'table' && (
                <>
                  <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3 md:col-span-2">
                    <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{ui.customerLabel}</label>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500" />
                  </div>
                  <div className="rounded-[1.35rem] border border-white/10 bg-black/25 px-4 py-3 md:col-span-2">
                    <label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">{ui.phoneLabel}</label>
                    <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^\d+\s]/g, ''))} inputMode="tel" className="mt-2 w-full bg-transparent text-base font-medium text-white outline-none placeholder:text-zinc-500" />
                  </div>
                </>
              )}
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowOrderInfoModal(false)} className="flex-1 rounded-[1.35rem] border border-white/10 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/5">
                Đóng
              </button>
              <button disabled={!hasOrderInfo} onClick={confirmOrderInfo} className="flex-1 rounded-[1.35rem] bg-orange-500 py-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
                {contextMode === 'table' ? 'Mở đơn theo bàn' : ui.confirmInfo}
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileCartOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-40 max-h-[55%] overflow-y-auto border-t border-white/10 bg-zinc-900/95 p-4 backdrop-blur lg:hidden">
          {cartEntries.map(([id, qty]) => {
            const item = menuItems.find(menuItem => menuItem.id === id);
            if (!item) return null;
            return (
              <div key={id} className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.nameVi}</p>
                  <p className="mt-1 text-xs text-orange-400">{formatCurrency(item.price * qty)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(id, -1)} className="rounded-full bg-white/5 p-2"><Minus size={14} /></button>
                  <span className="w-5 text-center text-sm font-bold">{qty}</span>
                  <button onClick={() => updateQty(id, 1)} className="rounded-full bg-white/5 p-2"><Plus size={14} /></button>
                  <button onClick={() => updateQty(id, -qty)} className="rounded-full bg-white/5 p-2 text-zinc-400"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          <button className="mt-2 text-xs underline" onClick={() => setMobileCartOpen(false)}>Đóng</button>
        </div>
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-white/10 bg-zinc-900/95 p-3 text-white backdrop-blur lg:hidden">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] opacity-70">{totalItems} {ui.items}</span>
            <span className="font-bold text-orange-400">{formatCurrency(totalPrice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileCartOpen(!mobileCartOpen)} className="text-xs underline">Sửa</button>
            <button onClick={placeOrder} disabled={isLoading} className="flex items-center rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white">
              {isLoading ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> : ui.btn}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-8 p-4 font-sans lg:flex-row lg:p-8">
        <div className="flex-1">
          <header className={`mb-6 rounded-[2rem] border p-5 backdrop-blur-xl lg:p-7 ${panelClass}`}>
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <h1 className="flex items-center gap-3 text-3xl font-black italic tracking-tight lg:text-5xl">
                  HCH RESTO
                  <Utensils className="text-orange-500" />
                </h1>
                <p className={`mt-3 max-w-2xl text-sm leading-6 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  Order nhanh tại bàn, nhìn rõ bàn hiện tại và nối đơn khách trên cùng một màn hình.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em]">
                  <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-orange-300">{ui.placedBy}: {staffSession.name || staffSession.username}</span>
                  {hasOrderInfo && <span className={`rounded-full border px-3 py-1 ${isDark ? 'border-white/10 text-zinc-300' : 'border-zinc-200 text-zinc-600'}`}>{ui.tableLabel} {tableInfo.table} • {ui.floorLabel} {tableInfo.floor} • {customerName}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setIsDark(!isDark)} className={`rounded-2xl border p-3 transition-all ${isDark ? 'border-zinc-800 bg-zinc-900 text-orange-400' : 'border-zinc-200 bg-white text-zinc-900 shadow-sm'}`}>
                  {isDark ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button onClick={() => { setContextMode('order'); setTableInfo({ table: '', floor: '' }); setCustomerName(''); setCustomerPhone(''); setCart({}); setHistoryItems({}); setLinkedOrderIds([]); setShowOrderInfoModal(true); }} className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/15">
                  {ui.orderMode}
                </button>
                <button onClick={() => { setContextMode('table'); setCart({}); setShowOrderInfoModal(true); }} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15">
                  {ui.tableMode}
                </button>
                <button onClick={handleLogout} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}>
                  <span className="inline-flex items-center gap-2"><LogOut size={16} /> {ui.logout}</span>
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className={summaryCardClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Bàn hiện tại</p>
                <p className="mt-2 text-xl font-black">{tableInfo.table ? `${tableInfo.table} • ${ui.floorLabel} ${tableInfo.floor}` : 'Chưa chọn bàn'}</p>
                <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{linkedOrders.length > 0 ? 'Đã tìm thấy đơn cũ của bàn này.' : 'Có thể đổi bàn hoặc tạo order mới bất kỳ lúc nào.'}</p>
              </div>
              <div className={summaryCardClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Khách đang phục vụ</p>
                <p className="mt-2 text-xl font-black">{customerName || 'Chưa có tên khách'}</p>
                <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{customerPhone || 'Chưa có số điện thoại'}</p>
              </div>
              <div className={summaryCardClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Phiếu hiện tại</p>
                <p className="mt-2 text-xl font-black text-orange-500">{totalItems} {ui.items}</p>
                <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{linkedOrderIds.length > 0 ? `Đang nối ${linkedOrderIds.length} đơn mở của bàn này` : contextMode === 'order' ? 'Đang tạo phiếu mới' : 'Chưa tìm thấy đơn mở'}</p>
              </div>
            </div>
          </header>
          {navSections.length > 0 && (
            <div className="sticky top-3 z-20 mb-8">
              <div className={`rounded-[1.75rem] border px-4 py-4 backdrop-blur-xl ${panelClass}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">Danh mục món</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Chạm để nhảy nhanh đến nhóm món cần order.</p>
                  </div>
                  <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">{navSections.length} nhóm</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {navSections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition-all ${activeCategoryId === section.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : isDark ? 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                    >
                      {renderCategoryIcon(section.icon, section.name, 'mr-2 inline-block h-5 w-5 rounded-full object-cover text-base')}
                      {section.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-3xl font-black italic">Chọn món cho bàn<span className="text-orange-500">.</span></h2>
            <p className={`mt-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Thêm món nhanh, hệ thống sẽ giữ đúng phiếu order theo bàn bạn đang phục vụ.</p>
          </div>

          {menuItems.length === 0 && (
            <div className={`mb-8 rounded-[2rem] border p-8 ${isDark ? 'border-zinc-800 bg-zinc-900/80 text-zinc-300' : 'border-zinc-200 bg-white/80 text-zinc-600'}`}>
              <p className="mb-2 text-lg font-bold">Menu đang trống</p>
              <p>Nhân viên sẽ thêm món từ trang admin. Khi có sản phẩm mới, menu này sẽ tự cập nhật.</p>
            </div>
          )}

          <div className="space-y-10">
            {menuSections.map(section => (
              <section key={section.id} id={section.id} ref={node => { sectionRefs.current[section.id] = node; }} className="scroll-mt-52 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {renderCategoryIcon(section.icon, section.name, 'h-11 w-11 rounded-2xl object-cover text-2xl')}
                    <div>
                      <h3 className="text-xl font-black">{section.name}</h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{section.items.length} món sẵn sàng phục vụ</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{section.items.map(renderMenuCard)}</div>
              </section>
            ))}

            {uncategorizedItems.length > 0 && (
              <section id="uncategorized" ref={node => { sectionRefs.current.uncategorized = node; }} className="scroll-mt-52 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <h3 className="text-xl font-black">Chưa phân loại</h3>
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{uncategorizedItems.length} món chưa gắn danh mục</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{uncategorizedItems.map(renderMenuCard)}</div>
              </section>
            )}
          </div>
        </div>

        <aside className="hidden w-full lg:block lg:w-[420px]">
          <div className={`sticky top-8 flex min-h-[640px] flex-col rounded-[2.5rem] border p-6 transition-all ${isDark ? 'border-white/10 bg-zinc-950/88 text-white shadow-[0_28px_70px_rgba(0,0,0,0.34)]' : 'border-white bg-white/88 text-zinc-900 shadow-[0_28px_70px_rgba(249,115,22,0.12)]'}`}>
            <div className={`rounded-[1.8rem] border p-5 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-orange-100 bg-orange-50/70'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{ui.currentOrder}</p>
                <button onClick={resetCurrentContext} className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] transition ${isDark ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-zinc-200 text-zinc-600 hover:bg-white'}`}>
                  {ui.closeInfo}
                </button>
              </div>
              <div className="mt-4 grid gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">{ui.tableLabel}</p>
                  <p className="mt-1 text-lg font-black">{tableInfo.table || '--'}{tableInfo.floor ? ` • ${ui.floorLabel} ${tableInfo.floor}` : ''}</p>
                </div>
                <div>
                  <p className="text-zinc-500">{ui.customerLabel}</p>
                  <p className="mt-1 font-semibold">{customerName || '--'}</p>
                </div>
                <div>
                  <p className="text-zinc-500">{ui.phoneLabel}</p>
                  <p className="mt-1 font-semibold">{customerPhone || '--'}</p>
                </div>
                <div>
                  <p className="text-zinc-500">{ui.linkedOrder}</p>
                  <p className="mt-1 font-semibold text-orange-400">{linkedOrderIds.length ? linkedOrderIds.map(id => `#${id}`).join(', ') : 'Chưa nối đơn'}</p>
                </div>
              </div>
            </div>

            {paymentOrders.length > 0 && (
              <div className={`mt-4 rounded-[1.6rem] border p-4 ${isDark ? 'border-emerald-500/15 bg-emerald-500/[0.06]' : 'border-emerald-100 bg-emerald-50/80'}`}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Thanh toán tự động</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Nhân viên có thể thu tiền ngay cho các bill đang mở của bàn này.</p>
                  </div>
                  <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    {formatCurrency(paymentTotal)}
                  </div>
                </div>
                <div className="space-y-2">
                  {paymentOrders.map(order => (
                    <div key={`payment-staff-${order.id}`} className={`rounded-2xl border px-3 py-3 ${isDark ? 'border-white/10 bg-black/20' : 'border-zinc-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>#{order.id}</p>
                          <p className={`mt-1 text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{order.customer || 'Khách lẻ'} • {order.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-400">{formatCurrency(order.total || 0)}</p>
                          <p className={`mt-1 text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{order.items.reduce((sum, item) => sum + item.qty, 0)} món</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openPaymentPage(order.id)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${isDark ? 'border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'}`}
                        >
                          Mở bill
                        </button>
                        <button
                          type="button"
                          onClick={() => payOrderNow(order)}
                          className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                        >
                          Thu tiền ngay
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {historyEntries.length > 0 && (
              <div className={`mt-4 rounded-[1.6rem] border p-4 ${isDark ? 'border-cyan-500/10 bg-cyan-500/[0.04]' : 'border-cyan-100 bg-cyan-50/80'}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Đơn cũ của bàn</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Các món đã lên trước đó, bếp sẽ không nhận lại phần này.</p>
                  </div>
                  <div className="rounded-full bg-cyan-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    {historyEntries.reduce((sum, [, qty]) => sum + qty, 0)} món
                  </div>
                </div>
                <div className="space-y-2">
                  {historyEntries.map(([id, qty]) => {
                    const item = menuItems.find(menuItem => menuItem.id === id);
                    if (!item) return null;
                    return (
                      <div key={`history-${id}`} className={`flex items-center justify-between rounded-2xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}>
                        <span className="text-sm font-semibold">{item.nameVi}</span>
                        <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">x{qty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-6 mt-6 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-black italic">{contextMode === 'table' ? 'Món gọi thêm' : ui.order}<span className="text-orange-500">.</span></h2>
                <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{contextMode === 'table' ? 'Chỉ các món mới trong phiếu này sẽ được gửi xuống bếp.' : 'Kiểm tra món trước khi gửi xuống bếp.'}</p>
              </div>
              <div className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">{totalItems} {ui.items}</div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {cartEntries.length === 0 ? (
                <div className={`rounded-[1.75rem] border px-5 py-12 text-center ${isDark ? 'border-white/5 bg-white/[0.02] text-zinc-500' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em]">{ui.empty}</p>
                  <p className="mt-3 text-sm normal-case tracking-normal">Chọn món ở bên trái để tạo phiếu cho bàn đang phục vụ.</p>
                </div>
              ) : cartEntries.map(([id, qty]) => {
                const item = menuItems.find(menuItem => menuItem.id === id);
                if (!item) return null;
                return (
                  <div key={id} className={`rounded-[1.6rem] border p-4 ${isDark ? 'border-white/5 bg-white/[0.03]' : 'border-zinc-200 bg-zinc-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black leading-tight">{item.nameVi}</p>
                        <p className="mt-1 text-sm font-bold text-orange-500">{formatCurrency(item.price * qty)}</p>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-bold ${isDark ? 'bg-white/5 text-zinc-300' : 'bg-white text-zinc-600'}`}>x{qty}</div>
                    </div>
                    <div className={`mt-4 flex items-center justify-between rounded-[1.2rem] border px-3 py-2 ${isDark ? 'border-white/5 bg-black/20' : 'border-zinc-200 bg-white'}`}>
                      <button onClick={() => updateQty(id, -1)} className="rounded-full p-2 transition hover:bg-white/5"><Minus size={16} /></button>
                      <span className="text-base font-black">{qty}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(id, 1)} className="rounded-full p-2 transition hover:bg-white/5"><Plus size={16} /></button>
                        <button onClick={() => updateQty(id, -qty)} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/5 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`mt-6 rounded-[1.8rem] border p-5 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-orange-100 bg-orange-50/70'}`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">{ui.total}</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-orange-500">{formatCurrency(totalPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Dòng món</p>
                  <p className="mt-1 text-lg font-black">{cartEntries.length}</p>
                </div>
              </div>
              <button disabled={totalItems === 0 || isLoading} onClick={placeOrder} className="mt-5 flex w-full items-center justify-center rounded-[1.5rem] bg-orange-500 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-orange-900/30 transition-all hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                {isLoading ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" /> : ui.btn}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
