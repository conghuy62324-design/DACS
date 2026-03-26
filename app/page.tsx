"use client"
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Utensils,
  Plus,
  Minus,
  Trash2,
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

  const [cart, setCart] = useState<Record<string, number>>({});
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState('');

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [customerName, setCustomerName] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    const f = params.get('floor');
    if (t || f) {
      const info: TableInfo = { table: t || '', floor: f || '' };
      setTableInfo(info);
      const key = `customerName_${info.table}_${info.floor}`;
      const saved = localStorage.getItem(key);
      if (saved) setCustomerName(saved);

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
    setInventoryStock(readInventoryStock());

    const syncInventory = () => setInventoryStock(readInventoryStock());
    window.addEventListener('storage', syncInventory);
    const interval = window.setInterval(syncInventory, 2000);

    return () => {
      window.removeEventListener('storage', syncInventory);
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
        const [menuRes, categoriesRes] = await Promise.all([
          fetch('/api/menu'),
          fetch('/api/categories')
        ]);
        const menuData: MenuItem[] = await menuRes.json();
        const categoriesData: Category[] = await categoriesRes.json();
        setMenuItems(menuData);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
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
  const formatCurrency = (value: number) =>
    value.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');

  const menuSections = categories
    .map(category => ({
      ...category,
      items: menuItems.filter(item => item.categoryId === category.id || item.categoryName === category.name),
    }))
    .filter(section => section.items.length > 0);

  const uncategorizedItems = menuItems.filter(item =>
    !categories.some(category => category.id === item.categoryId || category.name === item.categoryName)
  );

  const navSections = [
    ...menuSections,
    ...(uncategorizedItems.length > 0 ? [{ id: 'uncategorized', name: lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized', icon: '📁' }] : []),
  ];

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
  if (tableInfo && !customerName) {
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
              const key = `customerName_${tableInfo.table}_${tableInfo.floor}`;
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
    if (totalItems === 0) return;
    setIsLoading(true);
    try {
      const payload = { cart, totalPrice, lang, customerName, table: tableInfo?.table, floor: tableInfo?.floor };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
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
      } else {
        throw new Error('bad');
      }
    } catch (e) {
      console.error(e);
      showToast(lang === 'vi' ? 'Lỗi đặt món' : 'Order failed', 'error');
    }
    setIsLoading(false);
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
    <div className={`min-h-screen transition-all duration-300 scroll-smooth ${isDark ? 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(180deg,#09090b_0%,#111114_100%)] text-white' : 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.10),_transparent_30%),linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] text-zinc-900'}`} style={{ paddingBottom: totalItems>0 ? '4rem' : undefined }}>
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

        {/* mobile cart editing panel */}
        {mobileCartOpen && (
          <div className="fixed bottom-16 left-0 right-0 bg-zinc-800 p-4 max-h-[50%] overflow-y-auto lg:hidden">
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
            <button
              className="mt-2 text-xs underline"
              onClick={() => setMobileCartOpen(false)}
            >
              Đóng
            </button>
          </div>
        )}

        {/* mobile sticky footer */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 text-white p-3 flex justify-between items-center lg:hidden">
            <div className="flex flex-col">
              <span className="text-xs uppercase opacity-70">
                {ui[lang].items}: {totalItems}
              </span>
              <span className="font-bold">{formatCurrency(totalPrice)}đ</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileCartOpen(!mobileCartOpen)}
                className="text-xs underline"
              >
                {lang === 'vi' ? 'Sửa' : 'Edit'}
              </button>
              <button
                onClick={placeOrder}
                disabled={isLoading}
                className="bg-orange-500 px-4 py-2 rounded-full font-black text-sm uppercase tracking-[0.1em] flex items-center"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin" />
                ) : (
                  ui[lang].btn
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
                            <span className="font-black text-2xl tracking-tighter">{formatCurrency(item.price)}đ</span>
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
                          <span className="font-black text-2xl tracking-tighter">{formatCurrency(item.price)}đ</span>
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
              <div className="bg-orange-500 px-3 py-1 rounded-full text-[10px] font-black">{totalItems} {ui[lang].items}</div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
              {cartEntries.length === 0 ? (
                <div className="opacity-20 text-center py-24 italic text-sm font-medium tracking-widest uppercase">{ui[lang].empty}</div>
              ) : (
                cartEntries.map(([id, qty]) => {
                  const item = menuItems.find(m => m.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between items-center animate-in slide-in-from-right-3 duration-300">
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-tight text-zinc-100">{lang === 'vi' ? item.nameVi : item.nameEn}</p>
                        <p className="text-orange-500 font-black text-xs mt-1">{formatCurrency(item.price * qty)}đ</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
                        <button onClick={() => updateQty(id, -1)} className="hover:text-orange-500 p-1"><Minus size={14} /></button>
                        <span className="font-black text-sm w-5 text-center">{qty}</span>
                        <button onClick={() => updateQty(id, 1)} className="hover:text-orange-500 p-1"><Plus size={14} /></button>
                        <button onClick={() => updateQty(id, -qty)} className="ml-1 text-zinc-600 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-10 pt-10 border-t border-white/10">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.3em] block mb-1">{ui[lang].total}</span>
                  <span className="text-4xl font-black text-orange-500 tracking-tighter drop-shadow-lg">
                    {formatCurrency(totalPrice)}đ
                  </span>
                </div>
              </div>
              <button
                disabled={totalItems === 0 || isLoading}
                onClick={placeOrder}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-700 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-orange-900/50 active:scale-95 transition-all flex justify-center items-center"
              >
                {isLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-r-transparent rounded-full animate-spin" />
                ) : (
                  ui[lang].btn
                )}
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
