"use client";
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Users,
  Shield,
  QrCode,
  LogOut,
  Sun,
  Moon,
  BarChart3,
  Percent
} from 'lucide-react';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
// charts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartDataLabels
);


// simple sidebar panel ids
type Panel = 'dashboard' | 'products' | 'categories' | 'orders' | 'customers' | 'inventory' | 'coupons' | 'reports' | 'accounts' | 'tables';

// shared types
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

interface CategoryType {
  id: string;
  name: string;
  icon: string;
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
  createdAt: string; // iso string
  deducted?: boolean;
}

interface StaffAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'staff';
  email?: string;
  phone?: string;
  twoFactorEnabled?: boolean;
}

interface TableInfo {
  id: string;
  table: string;
  floor: string;
  qr: string;
  active: boolean;
  status: 'empty' | 'occupied' | 'ordering';
}

type HistoryViewMode = 'today' | 'history';

type InventoryEntry = {
  initial: number;
  sold: number;
  incoming: number;
};

type InventoryState = Record<string, InventoryEntry>;

const DEFAULT_INVENTORY_ENTRY: InventoryEntry = {
  initial: 0,
  sold: 0,
  incoming: 0,
};

const readInventoryStock = (): InventoryState => {
  if (typeof window === 'undefined') return {};

  try {
    const saved = localStorage.getItem('inventoryStock');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveInventoryStock = (next: InventoryState) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('inventoryStock', JSON.stringify(next));
  } catch {
    // ignore
  }
};

const readDeductedOrderIds = () => {
  if (typeof window === 'undefined') return new Set<string>();

  try {
    const saved = localStorage.getItem('deductedOrderIds');
    return new Set<string>(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set<string>();
  }
};

const saveDeductedOrderIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('deductedOrderIds', JSON.stringify([...ids]));
  } catch {
    // ignore
  }
};

const getInventoryQuantity = (entry?: InventoryEntry) => {
  if (!entry) return 0;
  return entry.initial + entry.incoming - entry.sold;
};

const formatVND = (value: number) =>
  value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const getDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDate = (dateString: string, selectedDate: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` === selectedDate;
};

const CATEGORY_ICON_PRESETS = ['🍽️', '🍟', '🥤', '🍰', '🍜', '🍕', '🥗', '🍔', '☕', '🧋', '🍱', '📁'];

const isImageLikeValue = (value?: string) => {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/') || value.startsWith('/');
};

const DEFAULT_PRODUCT_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
      <rect width="320" height="240" rx="28" fill="#18181b"/>
      <rect x="24" y="24" width="272" height="192" rx="24" fill="#27272a"/>
      <circle cx="122" cy="104" r="24" fill="#f97316"/>
      <path d="M70 174l44-44 38 34 54-56 44 66H70z" fill="#52525b"/>
      <text x="160" y="206" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#fafafa">HCH RESTO</text>
    </svg>`
  );

const TableQrPanel: React.FC<{
  lang: 'vi' | 'en';
  isDark: boolean;
  tables: TableInfo[];
  saveTables: (tables: TableInfo[]) => void;
}> = ({ lang, isDark, tables, saveTables }) => {
  const [tableNumber, setTableNumber] = useState('');
  const [floor, setFloor] = useState('1');
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const [tableMessage, setTableMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const makeQrUrl = (table: string, tableFloor: string) => `${origin}/?table=${table}&floor=${tableFloor}`;

  const showTableMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setTableMessage({ type, text });
  };

  const createTable = () => {
    const normalizedFloor = floor.trim();
    const normalizedTable = tableNumber.trim().padStart(2, '0');
    if (!normalizedTable || !normalizedFloor) {
      showTableMessage('error', lang === 'vi' ? 'Vui lòng nhập số bàn và tầng.' : 'Please enter both table number and floor.');
      return;
    }

    const id = `${normalizedFloor}-${normalizedTable}`;
    if (tables.some(table => table.id === id)) {
      showTableMessage('error', lang === 'vi' ? 'Bàn này đã có QR rồi.' : 'This table already has a QR code.');
      return;
    }

    const next = [
      {
        id,
        table: normalizedTable,
        floor: normalizedFloor,
        qr: makeQrUrl(normalizedTable, normalizedFloor),
        active: true,
        status: 'empty' as const,
      },
      ...tables,
    ].sort((a, b) => {
      const floorCompare = a.floor.localeCompare(b.floor, undefined, { numeric: true });
      if (floorCompare !== 0) return floorCompare;
      return a.table.localeCompare(b.table, undefined, { numeric: true });
    });

    saveTables(next);
    setTableNumber('');
    showTableMessage('success', lang === 'vi' ? `Đã tạo QR cho bàn ${normalizedTable}, tầng ${normalizedFloor}.` : `QR created for table ${normalizedTable}, floor ${normalizedFloor}.`);
  };

  const regenerateQrs = () => {
    const next = tables.map(table => ({ ...table, qr: makeQrUrl(table.table, table.floor) }));
    saveTables(next);
    showTableMessage('success', lang === 'vi' ? 'Đã cập nhật lại toàn bộ link QR.' : 'All QR links were refreshed.');
  };

  const toggleActive = (id: string) => {
    saveTables(tables.map(table => (table.id === id ? { ...table, active: !table.active } : table)));
  };

  const setStatus = (id: string, status: TableInfo['status']) => {
    saveTables(tables.map(table => (table.id === id ? { ...table, status } : table)));
  };

  const deleteTable = (id: string) => {
    saveTables(tables.filter(table => table.id !== id));
    showTableMessage('info', lang === 'vi' ? 'Đã xóa bàn khỏi danh sách QR.' : 'Table removed from QR list.');
  };

  const printTableQr = (table: TableInfo) => {
    if (typeof window === 'undefined') return;
    const canvas = document.getElementById(`qr-${table.id}`) as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL('image/png');
    const printWindow = window.open('', '_blank', 'width=720,height=960');
    if (!printWindow || !dataUrl) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Table ${table.table}</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; background: #111827; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .sheet { width: 360px; padding: 32px; border-radius: 28px; background: #18181b; border: 1px solid #3f3f46; text-align: center; }
            .badge { display: inline-block; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(249,115,22,0.35); color: #fdba74; margin-bottom: 20px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 700; }
            img { width: 220px; height: 220px; border-radius: 24px; background: white; padding: 16px; }
            .title { font-size: 34px; font-weight: 800; margin: 0; }
            .subtitle { margin: 10px 0 24px; font-size: 16px; color: #d4d4d8; }
            .url { margin-top: 18px; font-size: 12px; color: #a1a1aa; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="badge">HCH RESTO QR</div>
            <h1 class="title">Bàn ${table.table}</h1>
            <p class="subtitle">Tầng ${table.floor}</p>
            <img src="${dataUrl}" alt="QR Table ${table.table}" />
            <p class="url">${table.qr}</p>
          </div>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadTablePng = (table: TableInfo) => {
    if (typeof window === 'undefined') return;
    const canvas = document.getElementById(`qr-${table.id}`) as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL('image/png');
    if (!dataUrl) return;

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `hch-resto-ban-${table.table}-tang-${table.floor}.png`;
    anchor.click();
  };

  const activeCount = tables.filter(table => table.active).length;
  const emptyCount = tables.filter(table => table.status === 'empty').length;
  const occupiedCount = tables.filter(table => table.status !== 'empty').length;

  const getPresenceTone = (status: TableInfo['status']) => {
    if (status === 'empty') {
      return {
        card: isDark
          ? 'border-emerald-500/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(24,24,27,0.92))] text-white'
          : 'border-emerald-200 bg-emerald-50 text-zinc-900',
        badge: 'bg-emerald-500 text-white',
        ring: isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-white/70',
        label: lang === 'vi' ? 'Trống' : 'Empty',
      };
    }

    return {
      card: isDark
        ? 'border-red-500/30 bg-[linear-gradient(180deg,rgba(239,68,68,0.12),rgba(24,24,27,0.94))] text-white'
        : 'border-red-200 bg-red-50 text-zinc-900',
      badge: 'bg-red-500 text-white',
      ring: isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-white/70',
      label: status === 'ordering' ? (lang === 'vi' ? 'Đang order' : 'Ordering') : (lang === 'vi' ? 'Có khách' : 'Occupied'),
    };
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              {lang === 'vi' ? 'QR bàn ăn' : 'Table QR'}
            </span>
            <div>
              <h2 className="text-3xl font-extrabold text-white">{lang === 'vi' ? 'Tạo QR từng bàn riêng lẻ' : 'Generate QR per table'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                {lang === 'vi'
                  ? 'Tạo từng mã QR theo số bàn và tầng, in hoặc tải PNG để dán lên từng bàn. Khách quét mã sẽ mở menu và thấy ô nhập thông tin trước khi đặt món.'
                  : 'Create QR codes by table and floor, then print or download PNG files for each table. Guests scanning the code open the menu and see the info popup first.'}
              </p>
            </div>
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Tổng bàn' : 'Tables'}</p>
              <p className="mt-2 text-3xl font-bold text-white">{tables.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Hoạt động' : 'Active'}</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Trống' : 'Empty'}</p>
              <p className="mt-2 text-3xl font-bold text-cyan-300">{emptyCount}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Có khách' : 'Occupied'}</p>
              <p className="mt-2 text-3xl font-bold text-red-300">{occupiedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {tableMessage && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            tableMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : tableMessage.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          }`}
        >
          {tableMessage.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
          <h3 className="text-xl font-bold text-white">{lang === 'vi' ? 'Thêm bàn mới' : 'Add new table'}</h3>
          <p className="mt-2 text-sm text-zinc-400">
            {lang === 'vi'
              ? 'Nhập đúng số bàn và tầng để tạo QR riêng cho từng bàn.'
              : 'Enter the exact table number and floor to create an individual QR code.'}
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Số bàn' : 'Table number'}</label>
              <input
                type="text"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={lang === 'vi' ? 'Ví dụ: 12' : 'Example: 12'}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Tầng' : 'Floor'}</label>
              <input
                value={floor}
                onChange={e => setFloor(e.target.value)}
                placeholder="1"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={createTable}
              className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              {lang === 'vi' ? 'Tạo QR cho bàn này' : 'Create table QR'}
            </button>
            <button
              type="button"
              onClick={regenerateQrs}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              {lang === 'vi' ? 'Cập nhật lại tất cả QR' : 'Refresh all QR'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tables.map(table => {
            const tone = getPresenceTone(table.status);

            return (
            <div
              key={table.id}
              className={`rounded-3xl border p-5 shadow-[0_16px_48px_rgba(0,0,0,0.22)] ${tone.card}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-2xl font-black">{lang === 'vi' ? 'Bàn' : 'Table'} {table.table}</div>
                  <div className={`mt-1 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{lang === 'vi' ? 'Tầng' : 'Floor'} {table.floor}</div>
                  <div className="mt-2 text-sm">
                    {lang === 'vi' ? 'Trạng thái' : 'Status'}: <span className="font-semibold">{tone.label}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(table.id)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${table.active ? tone.badge : 'bg-zinc-500 text-white'}`}
                  >
                    {table.active ? (lang === 'vi' ? 'Hoạt động' : 'Active') : (lang === 'vi' ? 'Tạm khoá' : 'Inactive')}
                  </button>
                  <select
                    value={table.status}
                    onChange={e => setStatus(table.id, e.target.value as TableInfo['status'])}
                    className={`rounded-2xl border px-3 py-2 text-sm ${isDark ? 'border-zinc-600 bg-zinc-800 text-white' : 'border-zinc-300 bg-white text-zinc-900'}`}
                  >
                    <option value="empty">{lang === 'vi' ? 'Trống' : 'Empty'}</option>
                    <option value="occupied">{lang === 'vi' ? 'Có khách' : 'Occupied'}</option>
                    <option value="ordering">{lang === 'vi' ? 'Đang order' : 'Ordering'}</option>
                  </select>
                </div>
              </div>

              <div className={`mt-5 rounded-[28px] border p-4 ${tone.ring}`}>
                <div className="flex items-center gap-4">
                  <div className="rounded-[24px] bg-white p-3">
                    <QRCodeCanvas id={`qr-${table.id}`} value={table.qr} size={112} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{lang === 'vi' ? 'Link QR' : 'QR link'}</p>
                    <div className={`mt-2 break-all text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{table.qr}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => printTableQr(table)}
                    className="rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    {lang === 'vi' ? 'In QR' : 'Print'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTablePng(table)}
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    {lang === 'vi' ? 'Tải PNG' : 'PNG'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTable(table.id)}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    {lang === 'vi' ? 'Xóa' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )})}

          {tables.length === 0 && (
            <div className="md:col-span-2 rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center text-zinc-400">
              {lang === 'vi' ? 'Chưa có bàn nào được tạo QR. Hãy thêm bàn đầu tiên ở khối bên trái.' : 'No QR tables yet. Add your first table from the panel on the left.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductsPanel: React.FC<{
  lang: 'vi' | 'en';
  isDark: boolean;
  menuItems: MenuItem[];
  categories: CategoryType[];
  fetchMenu: () => void;
  inventoryStock: InventoryState;
  setInventoryStock: React.Dispatch<React.SetStateAction<InventoryState>>;
}> = ({ lang, isDark, menuItems, categories, fetchMenu, inventoryStock, setInventoryStock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionVi, setDescriptionVi] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [rating, setRating] = useState('4');
  const [menuMsg, setMenuMsg] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setNameVi('');
    setNameEn('');
    setDescriptionVi('');
    setDescriptionEn('');
    setCategoryId('');
    setPrice('');
    setImage('');
    setRating('4');
  };

  const openEditForm = (item: MenuItem) => {
    setEditingId(item.id);
    setNameVi(item.nameVi);
    setNameEn(item.nameEn || '');
    setDescriptionVi(item.descriptionVi || '');
    setDescriptionEn(item.descriptionEn || '');
    setCategoryId(item.categoryId || categories.find(category => category.name === item.categoryName)?.id || '');
    setPrice(String(item.price || ''));
    setImage(item.image || '');
    setRating(String(item.rating || 4));
    setShowAddForm(true);
  };

  useEffect(() => {
    if (!nameVi.trim() || editingId) {
      if (!editingId) setNameEn('');
      return;
    }
    const timeout = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nameVi, from: 'vi', to: 'en' })
        });
        const data = await res.json();
        setNameEn(data.translatedText || nameVi);
      } catch {
        setNameEn(nameVi);
      } finally {
        setIsTranslating(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [nameVi, editingId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImage(file);
  };

  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalNameVi = nameVi.trim();
    const finalNameEn = nameEn.trim() || finalNameVi;
    const finalDescriptionVi = descriptionVi.trim();
    const finalDescriptionEn = descriptionEn.trim() || finalDescriptionVi;
    const finalImage = image.trim() || DEFAULT_PRODUCT_IMAGE;
    const finalPrice = Number(price);

    if (!finalNameVi || !categoryId || !Number.isFinite(finalPrice) || finalPrice <= 0) {
      setMenuMsg(lang === 'vi' ? 'Vui lòng nhập đủ tên, danh mục và giá hợp lệ.' : 'Please fill in name, category and a valid price.');
      return;
    }

    const payload = {
      id: editingId || undefined,
      nameVi: finalNameVi,
      nameEn: finalNameEn,
      descriptionVi: finalDescriptionVi,
      descriptionEn: finalDescriptionEn,
      categoryId,
      categoryName: categories.find(cat => cat.id === categoryId)?.name || '',
      price: finalPrice,
      image: finalImage,
      rating: Number(rating)
    };

    const res = await fetch('/api/menu', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      if (!editingId) {
        const result = await res.json().catch(() => ({}));
        const createdId = result?.item?.id as string | undefined;
        if (createdId) {
          setInventoryStock(prev => {
            if (prev[createdId]) return prev;
            const next = { ...prev, [createdId]: { ...DEFAULT_INVENTORY_ENTRY } };
            saveInventoryStock(next);
            return next;
          });
        }
      }
      setMenuMsg(editingId ? (lang === 'vi' ? 'Cập nhật thành công' : 'Updated successfully') : (lang === 'vi' ? 'Thêm thành công' : 'Added successfully'));
      resetForm(); setShowAddForm(false);
      fetchMenu();
      setTimeout(() => setMenuMsg(''), 2000);
    } else {
      const data = await res.json().catch(() => ({}));
      setMenuMsg(data.error || (lang === 'vi' ? 'Không thể lưu sản phẩm.' : 'Unable to save product.'));
    }
  };

  const deleteProduct = async (id: string) => {
    await fetch('/api/menu', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setInventoryStock(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      saveInventoryStock(next);
      return next;
    });
    fetchMenu();
  };

  const filteredProducts = menuItems.filter(item => {
    const matchSearch = item.nameVi.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (item.nameEn || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = !categoryFilter || item.categoryId === categoryFilter || item.categoryName === categories.find(category => category.id === categoryFilter)?.name;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold mb-2">{lang === 'vi' ? 'Quản lý Sản phẩm' : 'Products Management'}</h2>
          <p className="text-sm opacity-60">{filteredProducts.length} {lang === 'vi' ? 'sản phẩm' : 'products'}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition"
        >
          ➕ {lang === 'vi' ? 'Thêm sản phẩm' : 'Add Product'}
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${isDark ? 'bg-zinc-900' : 'bg-white'} rounded-2xl p-8 w-full max-w-2xl max-h-96 overflow-y-auto`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">{lang === 'vi' ? 'Thêm sản phẩm mới' : 'Add New Product'}</h3>
              <button onClick={() => setShowAddForm(false)} className="text-2xl opacity-50 hover:opacity-100">✕</button>
            </div>

            <form onSubmit={submitProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">{lang === 'vi' ? 'Tên (VI)' : 'Name (VI)'}</label>
                  <input
                    value={nameVi}
                    onChange={e => setNameVi(e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-300'}`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{lang === 'vi' ? 'Tên (EN)' : 'Name (EN)'}</label>
                  <input
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-300'}`}
                    placeholder={isTranslating ? '...' : ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">{lang === 'vi' ? 'Danh mục' : 'Category'}</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-300'}`}
                    required
                  >
                    <option value="">{lang === 'vi' ? 'Chọn danh mục' : 'Select category'}</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{lang === 'vi' ? 'Giá' : 'Price'}</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-300'}`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">{lang === 'vi' ? 'Đánh giá' : 'Rating'}</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={rating}
                    onChange={e => setRating(e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-300'}`}
                  />
                </div>
              </div>

              {/* Drag & Drop Image */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                  dragActive
                    ? 'bg-blue-500/20 border-blue-500'
                    : isDark ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-100 border-zinc-300'
                }`}
              >
                {image ? (
                  <div className="flex flex-col items-center">
                    <Image src={image} alt="preview" width={80} height={80} unoptimized className="rounded" />
                    <p className="text-xs mt-2 opacity-60">{lang === 'vi' ? 'Kéo thả để thay đổi' : 'Drag to change'}</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold mb-1">📷 {lang === 'vi' ? 'Kéo thả ảnh tại đây' : 'Drag image here'}</p>
                    <p className="text-xs opacity-60">{lang === 'vi' ? 'hoặc' : 'or'}</p>
                    <label className="text-blue-500 hover:underline text-sm mt-1 cursor-pointer inline-block">
                      {lang === 'vi' ? 'chọn từ máy' : 'select from device'}
                      <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={!nameVi.trim() || !categoryId || !price || Number(price) <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold transition"
                >
                  {lang === 'vi' ? 'Thêm' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                >
                  {lang === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </div>
              {menuMsg && <p className="text-green-500 text-sm">{menuMsg}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className={`rounded-lg p-4 flex flex-wrap gap-3 items-center ${isDark ? 'bg-zinc-900' : 'bg-white border border-zinc-200'}`}>
        <div className="flex-1 min-w-64">
          <input
            type="text"
            placeholder={lang === 'vi' ? 'Tìm theo tên, SKU...' : 'Search by name, SKU...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-300'}`}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-300'}`}
        >
          <option value="">{lang === 'vi' ? 'Tất cả danh mục' : 'All categories'}</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-300'}`}
        >
          <option value="">{lang === 'vi' ? 'Tất cả trạng thái' : 'All status'}</option>
          <option value="active">{lang === 'vi' ? 'Hoạt động' : 'Active'}</option>
          <option value="inactive">{lang === 'vi' ? 'Không hoạt động' : 'Inactive'}</option>
        </select>
        <button className={`px-4 py-2 rounded-lg font-semibold transition ${isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-200 hover:bg-zinc-300'}`}>
          🔄 {lang === 'vi' ? 'Lọc' : 'Filter'}
        </button>
      </div>

      {/* Products Table */}
      <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
        <table className="w-full">
          <thead className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">
                <input type="checkbox" className="rounded" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Sản phẩm' : 'Product'}</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Danh mục' : 'Category'}</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Giá' : 'Price'}</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Tồn kho' : 'Stock'}</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Trạng thái' : 'Status'}</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">{lang === 'vi' ? 'Thao tác' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((item) => (
              <tr key={item.id} className={`border-t ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" className="rounded" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Image src={item.image} width={40} height={40} alt="" className="rounded w-10 h-10 object-cover" />
                    <div>
                      <p className="font-semibold text-sm">{lang === 'vi' ? item.nameVi : (item.nameEn || item.nameVi)}</p>
                      <p className="text-xs opacity-50">SKU: N/A</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{item.categoryName || (lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized')}</td>
                <td className="px-4 py-3 text-sm font-semibold text-orange-500">{formatVND(item.price)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getInventoryQuantity(inventoryStock[item.id]) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-200'}`}>
                    {getInventoryQuantity(inventoryStock[item.id])}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getInventoryQuantity(inventoryStock[item.id]) > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {getInventoryQuantity(inventoryStock[item.id]) > 0 ? (lang === 'vi' ? 'Còn hàng' : 'In stock') : lang === 'vi' ? 'Hết hàng' : 'Out of stock'}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEditForm(item)} className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs">
                    {lang === 'vi' ? 'Sửa' : 'Edit'}
                  </button>
                  <button onClick={() => deleteProduct(item.id)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs">
                    {lang === 'vi' ? 'Xóa' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 opacity-50">
          <p>{lang === 'vi' ? 'Không tìm thấy sản phẩm' : 'No products found'}</p>
        </div>
      )}
    </div>
  );
};

const InventoryManagementPanel: React.FC<{
  lang: 'vi' | 'en';
  menuItems: MenuItem[];
  stock: InventoryState;
  setStock: React.Dispatch<React.SetStateAction<InventoryState>>;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}> = ({ lang, menuItems, stock, setStock, drafts, setDrafts }) => {
  const updateStockQuantity = (id: string, rawValue: string) => {
    setDrafts(prev => ({ ...prev, [id]: rawValue }));
  };

  const commitStockQuantity = (id: string) => {
    const rawValue = (drafts[id] ?? '0').replace(/[^\d]/g, '');
    const parsed = Number(rawValue);
    const quantity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

    setStock(prev => {
      const current = prev[id] || DEFAULT_INVENTORY_ENTRY;
      const next = {
        ...prev,
        [id]: {
          initial: quantity,
          sold: current.sold || 0,
          incoming: 0,
        },
      };
      saveInventoryStock(next);
      return next;
    });

    setDrafts(prev => ({ ...prev, [id]: String(quantity) }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl mb-4">{lang === 'vi' ? 'Quản lý kho' : 'Inventory Management'}</h2>
      <p className="text-sm text-zinc-200">{lang === 'vi' ? 'Nhập trực tiếp số lượng hiện có. Khi đơn được thanh toán, hệ thống sẽ tự trừ kho.' : 'Enter the current quantity directly. Paid orders will reduce stock automatically.'}</p>
      <table className="w-full table-fixed text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="w-[28%] px-3 py-3 text-left">{lang === 'vi' ? 'Món' : 'Item'}</th>
            <th className="w-[18%] px-3 py-3 text-center">{lang === 'vi' ? 'Tồn' : 'Stock'}</th>
            <th className="w-[16%] px-3 py-3 text-center">{lang === 'vi' ? 'Đã bán' : 'Sold'}</th>
            <th className="w-[16%] px-3 py-3 text-center">{lang === 'vi' ? 'Hiện còn' : 'Remaining'}</th>
            <th className="w-[22%] px-3 py-3 text-center">{lang === 'vi' ? 'Trạng thái' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          {menuItems.map(item => {
            const s = stock[item.id] || DEFAULT_INVENTORY_ENTRY;
            const remaining = getInventoryQuantity(s);
            return (
              <tr key={item.id} className="border-b hover:bg-zinc-900">
                <td className="px-3 py-3 align-middle">{lang === 'vi' ? item.nameVi : item.nameEn}</td>
                <td className="px-3 py-3 text-center align-middle">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={drafts[item.id] ?? String(s.initial)}
                    onChange={e => updateStockQuantity(item.id, e.target.value)}
                    onBlur={() => commitStockQuantity(item.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitStockQuantity(item.id);
                        e.currentTarget.blur();
                      }
                    }}
                    className="mx-auto block w-36 rounded-xl border border-zinc-600 bg-zinc-700 px-3 py-2 text-center text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                  />
                </td>
                <td className="px-3 py-3 text-center align-middle">{s.sold}</td>
                <td className="px-3 py-3 text-center align-middle font-semibold">{remaining}</td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${remaining > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {remaining > 0 ? (lang === 'vi' ? 'Còn hàng' : 'In stock') : lang === 'vi' ? 'Hết hàng' : 'Out of stock'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Dashboard Panel - Main dashboard with stat cards
const DashboardPanel: React.FC<{
  orders: OrderType[];
  menuItems: MenuItem[];
  inventoryStock: InventoryState;
}> = ({ orders, menuItems, inventoryStock }) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23,59,59,999);

  // Get last 7 days revenue data
  const getLast7DaysRevenue = () => {
    const data: number[] = [];
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      
      const dayRevenue = orders
        .filter(o => {
          const t = new Date(o.createdAt);
          return t >= d && t < nextDay && (o.status === 'Đã thanh toán' || o.status === 'Paid');
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);
      
      data.push(dayRevenue);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    return { labels, data };
  };

  const sevenDaysData = getLast7DaysRevenue();

  const todayOrders = orders.filter(o => {
    const t = new Date(o.createdAt);
    return t >= startOfDay && t <= endOfDay;
  });

  const todayRevenue = todayOrders
    .filter(o => o.status === 'Đã thanh toán' || o.status === 'Paid')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const pendingOrders = orders.filter(o => o.status === 'Chờ xử lý' || o.status === 'Processing').length;
  const totalCustomers = new Set(todayOrders.map(order => order.customer.trim()).filter(Boolean)).size;
  const totalInventory = menuItems.length;
  const dashboardOrderCount = todayOrders.length;
  void pendingOrders;

  const chartData = {
    labels: sevenDaysData.labels,
    datasets: [
      {
        label: 'Doanh thu',
        data: sevenDaysData.data,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Doanh thu hôm nay</p>
              <p className="text-3xl font-bold">{formatVND(todayRevenue)}</p>
              <p className="text-xs opacity-60 mt-2">7 ngày gần nhất: {formatVND(sevenDaysData.data.reduce((a, b) => a + b, 0))}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">💵</div>
          </div>
        </div>

        {/* Pending Orders Card */}
        <div className="bg-gradient-to-br from-pink-600 to-pink-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Đơn hàng</p>
              <p className="text-3xl font-bold">{dashboardOrderCount}</p>
              <p className="text-xs opacity-60 mt-2">Hôm nay: {todayOrders.length} đơn</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">🛒</div>
          </div>
        </div>

        {/* Customers Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Khách hàng</p>
              <p className="text-3xl font-bold">{totalCustomers}</p>
              <p className="text-xs opacity-60 mt-2">Khách quét QR hôm nay: {totalCustomers || 0}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">👥</div>
          </div>
        </div>

        {/* Inventory Card */}
        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Kho</p>
              <p className="text-3xl font-bold">{totalInventory}</p>
              <p className="text-xs opacity-60 mt-2">Số sản phẩm trong mục sản phẩm</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">📦</div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-gray-900 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">📊 Doanh thu 7 ngày gần nhất</h3>
          <p className="text-xs opacity-60">Cập nhật: {new Date().toLocaleTimeString('vi-VN')}</p>
        </div>
        <div className="h-72 bg-gray-800 rounded-lg p-4">
          <Line 
            data={chartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { 
                  enabled: true,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  borderColor: '#f59e0b',
                  borderWidth: 1,
                },
              },
              scales: {
                x: {
                  grid: { color: 'rgba(255,255,255,0.1)' },
                  ticks: { color: '#999' },
                },
                y: {
                  grid: { color: 'rgba(255,255,255,0.1)' },
                  ticks: { color: '#999' },
                  beginAtZero: true,
                },
              },
            }} 
          />
        </div>
      </div>
    </div>
  );
};

// Categories Panel
const CategoriesPanel: React.FC<{
  lang: 'vi' | 'en';
  isDark: boolean;
  categories: CategoryType[];
  fetchCategories: () => void;
}> = ({ lang, isDark, categories, fetchCategories }) => {
  const [newCategory, setNewCategory] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [iconUrl, setIconUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CategoryType | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetForm = () => {
    setNewCategory('');
    setNewIcon('📁');
    setIconUrl('');
    setEditingId(null);
  };

  const submitCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    const finalIcon = iconUrl.trim() || newIcon.trim() || '📁';

    const response = await fetch('/api/categories', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        name,
        icon: finalIcon,
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setNotice({
        type: 'error',
        message: result.error || (lang === 'vi' ? 'Không thể lưu danh mục.' : 'Unable to save category.')
      });
      return;
    }

    setNotice({
      type: 'success',
      message: editingId
        ? (lang === 'vi' ? 'Đã cập nhật danh mục.' : 'Category updated.')
        : (lang === 'vi' ? 'Đã thêm danh mục mới.' : 'Category added.')
    });
    resetForm();
    fetchCategories();
  };

  const startEdit = (category: CategoryType) => {
    setEditingId(category.id);
    setNewCategory(category.name);
    if (isImageLikeValue(category.icon)) {
      setIconUrl(category.icon);
      setNewIcon('📁');
    } else {
      setNewIcon(category.icon || '📁');
      setIconUrl('');
    }
  };

  const handleCategoryIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIconUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteCategory = async (id: string) => {
    const response = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setNotice({
        type: 'error',
        message: result.error || (lang === 'vi' ? 'Không thể xóa danh mục.' : 'Unable to delete category.')
      });
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setNotice({
      type: 'success',
      message: lang === 'vi' ? 'Đã xóa danh mục.' : 'Category deleted.'
    });
    setConfirmDelete(null);
    fetchCategories();
  };

  const categoryToDelete = confirmDelete;

  const confirmDeleteModal = categoryToDelete && typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${isDark ? 'border-zinc-700 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
            <p className="text-lg font-semibold">
              {lang === 'vi' ? 'Xóa danh mục' : 'Delete category'}
            </p>
            <p className={`mt-2 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {lang === 'vi'
                ? `Bạn có chắc muốn xóa "${categoryToDelete!.name}" không?`
                : `Are you sure you want to delete "${categoryToDelete!.name}"?`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => deleteCategory(categoryToDelete!.id)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {lang === 'vi' ? 'Xóa ngay' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`fixed right-6 top-6 z-50 min-w-[280px] max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
            notice.type === 'success'
              ? isDark
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : isDark
                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="text-sm font-medium">{notice.message}</p>
        </div>
      )}

      {confirmDeleteModal}

      {false && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${isDark ? 'border-zinc-700 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
            <p className="text-lg font-semibold">
              {lang === 'vi' ? 'Xóa danh mục' : 'Delete category'}
            </p>
            <p className={`mt-2 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {lang === 'vi'
                ? `Bạn có chắc muốn xóa "${categoryToDelete!.name}" không?`
                : `Are you sure you want to delete "${categoryToDelete!.name}"?`}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => deleteCategory(categoryToDelete!.id)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                {lang === 'vi' ? 'Xóa ngay' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`rounded-3xl border p-5 shadow-sm ${isDark ? 'border-zinc-800 bg-zinc-900/80' : 'border-zinc-200 bg-white'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{lang === 'vi' ? 'Quản lý danh mục' : 'Manage categories'}</h2>
            <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {lang === 'vi' ? 'Chỉ cần tên danh mục và một icon. Link ảnh hoặc ảnh từ máy là tùy chọn.' : 'Only category name and one icon are required. Image URL or upload is optional.'}
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-center ${isDark ? 'border-zinc-700 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
            {isImageLikeValue(iconUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="category icon preview" className="mx-auto h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="text-4xl">{newIcon || '📁'}</span>
            )}
            <p className={`mt-2 text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {lang === 'vi' ? 'Xem trước' : 'Preview'}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submitCategory}>
          <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
            <div className="space-y-3">
              <label className="block">
                <span className={`mb-2 block text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {lang === 'vi' ? 'Emoji / ký hiệu' : 'Emoji / symbol'}
                </span>
                <input
                  type="text"
                  value={newIcon}
                  onChange={e => {
                    setNewIcon(e.target.value);
                    if (e.target.value.trim()) setIconUrl('');
                  }}
                  placeholder="📁"
                  className={`w-full rounded-2xl border px-4 py-3 ${isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICON_PRESETS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => {
                      setNewIcon(icon);
                      setIconUrl('');
                    }}
                    className={`rounded-2xl border px-3 py-2 text-2xl transition ${newIcon === icon && !iconUrl ? 'border-orange-500 bg-orange-500/10' : isDark ? 'border-zinc-700 bg-zinc-950 hover:border-zinc-500' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-400'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className={`mb-2 block text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {lang === 'vi' ? 'Tên danh mục' : 'Category name'}
                </span>
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder={lang === 'vi' ? 'Ví dụ: Đồ nướng, Món phụ...' : 'Example: Grill, Side dishes...'}
                  className={`w-full rounded-2xl border px-4 py-3 ${isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </label>

              <label className="block">
                <span className={`mb-2 block text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {lang === 'vi' ? 'Link ảnh icon' : 'Icon image URL'}
                </span>
                <input
                  type="text"
                  value={iconUrl}
                  onChange={e => {
                    setIconUrl(e.target.value);
                    if (e.target.value.trim()) setNewIcon('');
                  }}
                  placeholder={lang === 'vi' ? 'Tùy chọn: https://... hoặc dán ảnh online' : 'Optional: https://... or paste an online image'}
                  className={`w-full rounded-2xl border px-4 py-3 ${isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </label>

              <label className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 ${isDark ? 'border-zinc-700 bg-zinc-950' : 'border-zinc-300 bg-zinc-50'}`}>
                <span className="text-sm font-medium">{lang === 'vi' ? 'Tải ảnh từ máy' : 'Upload from device'}</span>
                <input type="file" accept="image/*" onChange={handleCategoryIconFile} className="hidden" />
                <span className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                  {lang === 'vi' ? 'Chọn ảnh' : 'Choose image'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700">
              {editingId ? (lang === 'vi' ? 'Lưu thay đổi' : 'Save changes') : lang === 'vi' ? 'Thêm danh mục' : 'Add category'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className={`rounded-2xl px-5 py-3 font-semibold transition ${isDark ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300'}`}
              >
                {lang === 'vi' ? 'Hủy chỉnh sửa' : 'Cancel edit'}
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map(cat => (
          <div key={cat.id} className={`rounded-3xl border p-5 shadow-sm transition ${isDark ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
            <div className="mb-4 flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border ${isDark ? 'border-zinc-700 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
                {isImageLikeValue(cat.icon) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.icon} alt={cat.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">{cat.icon}</span>
                )}
              </div>
              <div>
                <p className="font-semibold">{cat.name}</p>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{cat.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => startEdit(cat)}
                className="rounded-xl bg-blue-500/10 px-3 py-2 font-medium text-blue-400 transition hover:bg-blue-500/20"
              >
                {lang === 'vi' ? 'Sửa' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(cat)}
                className="rounded-xl bg-red-500/10 px-3 py-2 font-medium text-red-400 transition hover:bg-red-500/20"
              >
                {lang === 'vi' ? 'Xóa' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Customers Panel
const CustomersPanel: React.FC<{
  lang: 'vi' | 'en';
  isDark: boolean;
  orders: OrderType[];
  viewMode: HistoryViewMode;
  selectedDate: string;
  onViewModeChange: (mode: HistoryViewMode) => void;
  onSelectedDateChange: (value: string) => void;
}> = ({lang, isDark, orders, viewMode, selectedDate, onViewModeChange, onSelectedDateChange}) => {
  const todayKey = getDateInputValue(new Date());

  const filteredOrders = orders.filter(order => {
    const orderDate = viewMode === 'today' ? todayKey : selectedDate;
    return isSameDate(order.createdAt, orderDate) && order.customer.trim();
  });

  const customers = Object.values(
    filteredOrders.reduce((acc, order) => {
      const key = order.customer.trim().toLowerCase();
      const current = acc[key] || {
        id: key,
        name: order.customer.trim(),
        totalOrders: 0,
        totalSpent: 0,
      };

      current.totalOrders += 1;
      current.totalSpent += order.total || 0;
      acc[key] = current;
      return acc;
    }, {} as Record<string, {id: string; name: string; totalOrders: number; totalSpent: number}>)
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{lang === 'vi' ? 'Quản lý khách hàng' : 'Manage customers'}</h2>
      <div className={`rounded-2xl border p-3 md:p-4 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className={`inline-flex w-fit rounded-2xl p-1 ${isDark ? 'bg-zinc-950/80' : 'bg-white shadow-sm'}`}>
        <button type="button" onClick={() => onViewModeChange('today')} className={`rounded-xl px-4 py-2 transition ${viewMode === 'today' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
          {lang === 'vi' ? 'Khách hôm nay' : 'Today customers'}
        </button>
        <button type="button" onClick={() => onViewModeChange('history')} className={`rounded-xl px-4 py-2 transition ${viewMode === 'history' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
          {lang === 'vi' ? 'Xem lịch sử' : 'History'}
        </button>
          </div>
          {viewMode === 'history' && (
            <label className="flex items-center gap-3">
              <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {lang === 'vi' ? 'Chọn ngày' : 'Choose date'}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => onSelectedDateChange(e.target.value)}
                className={`rounded-xl border px-4 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
              />
            </label>
          )}
        </div>
      </div>
      <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-zinc-700' : 'border-zinc-300'}`}>
        <table className="w-full">
          <thead className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'}>
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">{lang === 'vi' ? 'Tên' : 'Name'}</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">{lang === 'vi' ? 'Đơn hàng' : 'Orders'}</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">{lang === 'vi' ? 'Tổng chi tiêu' : 'Total spent'}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr key={customer.id} className={`border-t ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <td className="px-4 py-2 text-sm">{customer.name}</td>
                <td className="px-4 py-2 text-sm">{customer.totalOrders}</td>
                <td className="px-4 py-2 text-sm font-semibold text-orange-500">{formatVND(customer.totalSpent)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm opacity-70">
                  {lang === 'vi' ? 'Không có khách hàng trong ngày được chọn hoặc chưa có khách quét QR.' : 'No customer data for the selected day.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Coupons Panel
const CouponsPanel: React.FC<{lang: 'vi' | 'en'; isDark: boolean}> = ({lang, isDark}) => {
  const [coupons, setCoupons] = useState<Array<{id: string; code: string; discount: number; type: 'percent' | 'fixed'}>>([
    {id: '1', code: 'SUMMER20', discount: 20, type: 'percent'},
    {id: '2', code: 'NEWYEAR', discount: 50000, type: 'fixed'},
  ]);
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [newType, setNewType] = useState<'percent' | 'fixed'>('percent');

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{lang === 'vi' ? 'Quản lý mã giảm giá' : 'Manage coupons'}</h2>
      <form className="grid grid-cols-1 md:grid-cols-4 gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (newCode.trim() && newDiscount) {
          setCoupons([...coupons, {id: Date.now().toString(), code: newCode, discount: Number(newDiscount), type: newType}]);
          setNewCode('');
          setNewDiscount('');
        }
      }}>
        <input
          type="text"
          value={newCode}
          onChange={e => setNewCode(e.target.value)}
          placeholder="Code"
          className={`px-4 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white border-zinc-300'}`}
        />
        <input
          type="number"
          value={newDiscount}
          onChange={e => setNewDiscount(e.target.value)}
          placeholder={lang === 'vi' ? 'Giá trị' : 'Value'}
          className={`px-4 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white border-zinc-300'}`}
        />
        <select value={newType} onChange={e => setNewType(e.target.value as 'percent' | 'fixed')} className={`px-4 py-2 rounded border ${isDark ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white border-zinc-300'}`}>
          <option value="percent">%</option>
          <option value="fixed">{lang === 'vi' ? 'VNĐ' : 'VND'}</option>
        </select>
        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition">{lang === 'vi' ? 'Thêm' : 'Add'}</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map(coupon => (
          <div key={coupon.id} className={`p-4 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}>
            <p className="font-bold text-lg text-cyan-400">{coupon.code}</p>
            <p className="text-sm mt-1">{coupon.discount}{coupon.type === 'percent' ? '%' : ' đ'}</p>
            <button className="text-xs text-red-500 hover:text-red-700 mt-2">{lang === 'vi' ? 'Xóa' : 'Delete'}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AdminPage() {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [isDark, setIsDark] = useState(true);
  const [panel, setPanel] = useState<Panel>('dashboard');

  // shared data
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [inventoryStock, setInventoryStock] = useState<InventoryState>({});
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [pendingTwoFactor, setPendingTwoFactor] = useState<{
    accountId: string;
    email: string;
    devOtp?: string;
    deliveryWarning?: string;
  } | null>(null);
  const [authError, setAuthError] = useState('');
  const [orderViewMode, setOrderViewMode] = useState<HistoryViewMode>('today');
  const [orderSelectedDate, setOrderSelectedDate] = useState(getDateInputValue(new Date()));
  const [customerViewMode, setCustomerViewMode] = useState<HistoryViewMode>('today');
  const [customerSelectedDate, setCustomerSelectedDate] = useState(getDateInputValue(new Date()));

  const saveTables = (next: TableInfo[]) => {
    setTables(next);
    try {
      localStorage.setItem('tables', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const updateTableStatusByOrder = useCallback((tableNumber?: string, floor?: string, status: TableInfo['status'] = 'empty') => {
    if (!tableNumber || !floor) return;

    setTables(current => {
      let changed = false;
      const next = current.map(table => {
        if (table.table === tableNumber && table.floor === floor) {
          if (table.status === status) return table;
          changed = true;
          return { ...table, status };
        }
        return table;
      });

      if (changed) {
        try {
          localStorage.setItem('tables', JSON.stringify(next));
        } catch {
          // ignore
        }
      }

      return changed ? next : current;
    });
  }, []);

  const currentUser = accounts.find(acc => acc.id === currentUserId);

  // handy ui text
  const t = {
    vi: {
      dashboard: 'Dashboard',
      products: 'Sản phẩm',
      categories: 'Danh mục',
      orders: 'Đơn hàng',
      customers: 'Khách hàng',
      inventory: 'Tồn kho',
      coupons: 'Mã giảm giá',
      reports: 'Báo cáo',
      accounts: 'Tài khoản',
      management: 'Quản lý nhà hàng'
    },
    en: {
      dashboard: 'Dashboard',
      products: 'Products',
      categories: 'Categories',
      orders: 'Orders',
      customers: 'Customers',
      inventory: 'Inventory',
      coupons: 'Coupons',
      reports: 'Reports',
      accounts: 'Accounts',
      management: 'Restaurant Management'
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      setMenuItems(data);
    } catch (err) {
      console.error('Failed to fetch menu', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;
      if (Array.isArray(data)) setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tables');
      const parsed = raw ? JSON.parse(raw) : [];
      setTables(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTables([]);
    }
  }, []);

  useEffect(() => {
    const syncTables = () => {
      try {
        const raw = localStorage.getItem('tables');
        const parsed = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(parsed) ? parsed : [];
        setTables(current => {
          if (JSON.stringify(current) === JSON.stringify(next)) return current;
          return next;
        });
      } catch {
        // ignore malformed local storage payloads
      }
    };

    window.addEventListener('storage', syncTables);
    const interval = window.setInterval(syncTables, 1500);

    return () => {
      window.removeEventListener('storage', syncTables);
      window.clearInterval(interval);
    };
  }, []);

  const loadCurrentUserId = () => {
    try {
      const current = localStorage.getItem('currentUserId');
      if (current) setCurrentUserId(current);
    } catch {
      // ignore
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (data?.session?.sub) {
        setCurrentUserId(data.session.sub);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkSession();
    fetchMenu();
    fetchCategories();
    fetchOrders();
    fetchAccounts();
    setInventoryStock(readInventoryStock());

    const interval = setInterval(() => {
      fetchMenu();
      fetchCategories();
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'inventoryStock') {
        setInventoryStock(readInventoryStock());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!currentUserId && accounts.length > 0) {
      setCurrentUserId(accounts[0].id);
      return;
    }
    if (currentUserId && !accounts.find(a => a.id === currentUserId) && accounts.length > 0) {
      setCurrentUserId(accounts[0].id);
    }
  }, [accounts, currentUserId]);

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem('currentUserId', currentUserId);
    } catch {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!menuItems.length) return;

    setInventoryStock(prev => {
      let changed = false;
      const next: InventoryState = {};

      menuItems.forEach(item => {
        if (prev[item.id]) {
          next[item.id] = prev[item.id];
        } else {
          next[item.id] = { ...DEFAULT_INVENTORY_ENTRY };
          changed = true;
        }
      });

      const prevKeys = Object.keys(prev);
      if (prevKeys.length !== Object.keys(next).length) {
        changed = true;
      }

      if (!changed) return prev;
      saveInventoryStock(next);
      return next;
    });
  }, [menuItems]);

  useEffect(() => {
    setInventoryDrafts(prev => {
      const next: Record<string, string> = {};
      let changed = false;

      menuItems.forEach(item => {
        const quantity = String((inventoryStock[item.id] || DEFAULT_INVENTORY_ENTRY).initial ?? 0);
        next[item.id] = prev[item.id] ?? quantity;
        if (!(item.id in prev)) changed = true;
      });

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;

      return changed ? next : prev;
    });
  }, [inventoryStock, menuItems]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed');
        return;
      }

      if (data.requiresTwoFactor) {
        setPendingTwoFactor({
          accountId: data.accountId,
          email: data.email,
          devOtp: data.devOtp,
          deliveryWarning: data.deliveryWarning,
        });
        if (data.devOtp) {
          setLoginOtp(data.devOtp);
        }
        return;
      }

      setIsAuthenticated(true);
      await checkSession();
    } catch {
      setAuthError('Không thể đăng nhập admin.');
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTwoFactor) return;
    setAuthError('');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: pendingTwoFactor.accountId, code: loginOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'OTP verification failed');
        return;
      }

      setPendingTwoFactor(null);
      setLoginOtp('');
      setIsAuthenticated(true);
      await checkSession();
    } catch {
      setAuthError('Không thể xác thực mã OTP.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setCurrentUserId('');
    setPendingTwoFactor(null);
    setLoginPassword('');
    setLoginOtp('');
  };

  // components inside panel
  const subtractInventoryForOrder = (order: OrderType) => {
    const deductedOrderIds = readDeductedOrderIds();
    if (deductedOrderIds.has(order.id)) return;

    setInventoryStock(prev => {
      const next = { ...prev };

      order.items.forEach(i => {
        const current = next[i.id] || DEFAULT_INVENTORY_ENTRY;
        next[i.id] = { ...current, sold: current.sold + i.qty };
      });

      saveInventoryStock(next);
      return next;
    });

    deductedOrderIds.add(order.id);
    saveDeductedOrderIds(deductedOrderIds);
  };

  const OrderPanel: React.FC<{
    orders: OrderType[];
    setOrders: React.Dispatch<React.SetStateAction<OrderType[]>>;
    viewMode: HistoryViewMode;
    selectedDate: string;
    onViewModeChange: (mode: HistoryViewMode) => void;
    onSelectedDateChange: (value: string) => void;
  }> = ({ orders, setOrders, viewMode, selectedDate, onViewModeChange, onSelectedDateChange }) => {
    const todayKey = getDateInputValue(new Date());
    const [origin, setOrigin] = useState('');
    const [detailOrder, setDetailOrder] = useState<OrderType | null>(null);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        setOrigin(window.location.origin);
      }
    }, []);

    const filteredOrders = orders
      .filter(order => {
        const activeDate = viewMode === 'today' ? todayKey : selectedDate;
        return isSameDate(order.createdAt, activeDate);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const counts = filteredOrders.reduce(
      (acc, order) => {
        const status = order.status;
        if (status === 'Chờ xử lý' || status === 'Processing') acc.processing++;
        if (status === 'Đang nấu' || status === 'Cooking') acc.cooking++;
        if (status === 'Đã nấu xong' || status === 'Cooked') acc.cooked++;
        if (status === 'Từ chối' || status === 'Rejected') acc.rejected++;
        if (status === 'Đã phục vụ' || status === 'Served') acc.served++;
        if (status === 'Đã thanh toán' || status === 'Paid') acc.paid++;
        return acc;
      },
      { processing: 0, cooking: 0, cooked: 0, rejected: 0, served: 0, paid: 0 },
    );

    const updateStatus = async (id: string, newStatus: string) => {
      const targetOrder = orders.find(order => order.id === id);

      setOrders(current =>
        current.map(order => {
          if (order.id !== id) return order;
          const next = { ...order, status: newStatus };
          if ((newStatus === 'Đã thanh toán' || newStatus === 'Paid') && !next.deducted) {
            subtractInventoryForOrder(next);
            next.deducted = true;
          }
          return next;
        }),
      );

      if (targetOrder?.table && targetOrder?.floor) {
        if (newStatus === 'Đã thanh toán' || newStatus === 'Paid') {
          updateTableStatusByOrder(targetOrder.table, targetOrder.floor, 'empty');
        } else if (newStatus === 'Chờ xử lý' || newStatus === 'Processing' || newStatus === 'Đang nấu' || newStatus === 'Cooking' || newStatus === 'Đã nấu xong' || newStatus === 'Cooked' || newStatus === 'Đã phục vụ' || newStatus === 'Served') {
          updateTableStatusByOrder(targetOrder.table, targetOrder.floor, 'ordering');
        }
      }

      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus }),
        });
      } catch (err) {
        console.error('Failed to update order status', err);
      }
    };

    const updateHandler = async (id: string, handler: string) => {
      setOrders(current => current.map(order => (order.id === id ? { ...order, handler } : order)));
      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, handler }),
        });
      } catch (err) {
        console.error('Failed to update handler', err);
      }
    };

    const printOrder = (order: OrderType) => {
      const text = order.items
        .map(item => {
          const menu = menuItems.find(menuEntry => menuEntry.id === item.id);
          const name = menu ? (lang === 'vi' ? menu.nameVi : menu.nameEn) : item.id;
          return `${name} x${item.qty}`;
        })
        .join('\n');
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<pre>${t[lang].management} - ${t[lang].orders}\n\n`);
      win.document.write(`Table: ${order.table} (Floor ${order.floor})\n`);
      win.document.write(`Customer: ${order.customer}\n`);
      win.document.write(`Items:\n${text}\n\n`);
      win.document.write(`Total: ${formatVND(order.total || 0)}\n`);
      win.document.write(`</pre>`);
      win.document.write(`<script>window.print();window.onafterprint=function(){window.close();}</script>`);
      win.document.close();
    };

    const statuses = [
      lang === 'vi' ? 'Chờ xử lý' : 'Processing',
      lang === 'vi' ? 'Đang nấu' : 'Cooking',
      lang === 'vi' ? 'Đã nấu xong' : 'Cooked',
      lang === 'vi' ? 'Từ chối' : 'Rejected',
      lang === 'vi' ? 'Đã phục vụ' : 'Served',
      lang === 'vi' ? 'Đã thanh toán' : 'Paid',
    ];

    const payUrl = (id: string) => `${origin}/pay/${id}`;

    const summaryLabelMap: Record<string, string> = {
      processing: lang === 'vi' ? 'Chờ xử lý' : 'Processing',
      cooking: lang === 'vi' ? 'Đang nấu' : 'Cooking',
      cooked: lang === 'vi' ? 'Đã nấu xong' : 'Cooked',
      rejected: lang === 'vi' ? 'Từ chối' : 'Rejected',
      served: lang === 'vi' ? 'Đã phục vụ' : 'Served',
      paid: lang === 'vi' ? 'Đã thanh toán' : 'Paid',
    };

    const getStatusTone = (status: string) => {
      if (status === 'Đang nấu' || status === 'Cooking') {
        return {
          badge: 'border border-amber-300/40 bg-amber-400/20 text-amber-100',
          card: isDark ? 'border-amber-300/40 bg-amber-400/10 shadow-[0_18px_40px_-26px_rgba(251,191,36,0.75)]' : 'border-amber-300 bg-amber-50',
        };
      }

      if (status === 'Đã nấu xong' || status === 'Cooked') {
        return {
          badge: 'border border-sky-300/40 bg-sky-400/20 text-sky-100',
          card: isDark ? 'border-sky-300/40 bg-sky-500/10 shadow-[0_18px_40px_-26px_rgba(56,189,248,0.8)]' : 'border-sky-300 bg-sky-50',
        };
      }

      if (status === 'Chờ xử lý' || status === 'Processing') {
        return {
          badge: 'border border-cyan-300/30 bg-cyan-400/15 text-cyan-100',
          card: isDark ? 'border-cyan-400/30 bg-cyan-500/8' : 'border-cyan-200 bg-cyan-50',
        };
      }

      if (status === 'Từ chối' || status === 'Rejected') {
        return {
          badge: 'border border-rose-300/30 bg-rose-400/15 text-rose-100',
          card: isDark ? 'border-rose-400/30 bg-rose-500/8' : 'border-rose-200 bg-rose-50',
        };
      }

      if (status === 'Đã phục vụ' || status === 'Served') {
        return {
          badge: 'border border-emerald-300/30 bg-emerald-400/15 text-emerald-100',
          card: isDark ? 'border-emerald-400/30 bg-emerald-500/8' : 'border-emerald-200 bg-emerald-50',
        };
      }

      return {
        badge: 'border border-indigo-300/30 bg-indigo-400/15 text-indigo-100',
        card: isDark ? 'border-indigo-400/30 bg-indigo-500/8' : 'border-indigo-200 bg-indigo-50',
      };
    };

    return (
      <div className="space-y-6">
        <div className={`rounded-2xl border p-3 md:p-4 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className={`inline-flex w-fit rounded-2xl p-1 ${isDark ? 'bg-zinc-950/80' : 'bg-white shadow-sm'}`}>
              <button
                type="button"
                onClick={() => onViewModeChange('today')}
                className={`rounded-xl px-4 py-2 transition ${viewMode === 'today' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {lang === 'vi' ? 'Đơn hôm nay' : 'Today orders'}
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('history')}
                className={`rounded-xl px-4 py-2 transition ${viewMode === 'history' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {lang === 'vi' ? 'Xem lịch sử' : 'History'}
              </button>
            </div>

            {viewMode === 'history' && (
              <label className="flex items-center gap-3">
                <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {lang === 'vi' ? 'Chọn ngày' : 'Choose date'}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => onSelectedDateChange(e.target.value)}
                  className={`rounded-xl border px-4 py-2 ${isDark ? 'border-zinc-700 bg-zinc-800 text-white' : 'border-zinc-300 bg-white text-zinc-900'}`}
                />
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {Object.entries(counts).map(([key, value]) => (
            <span
              key={key}
              className="rounded-full bg-linear-to-r from-blue-500 to-cyan-500 px-3 py-1 text-sm font-semibold text-white shadow-sm"
            >
              {summaryLabelMap[key]}: {value}
            </span>
          ))}
        </div>

        {filteredOrders.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredOrders.map((order, index) => {
              const totalItems = order.items.reduce((sum, item) => sum + item.qty, 0);
              const tone = getStatusTone(order.status);

              return (
                <article
                  key={order.id}
                  className={`rounded-[22px] border p-3.5 transition ${tone.card} ${isDark ? 'text-white' : 'text-zinc-900'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${isDark ? 'bg-black/30 text-zinc-200' : 'bg-white/80 text-zinc-700'}`}>
                          {lang === 'vi' ? `Thứ tự #${index + 1}` : `Queue #${index + 1}`}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                          {order.status}
                        </span>
                      </div>

                      <div>
                        <p className="text-lg font-black leading-tight md:text-[1.7rem]">
                          {lang === 'vi' ? 'Đơn' : 'Order'} #{order.id}
                        </p>
                        <p className={`mt-0.5 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                          {lang === 'vi' ? `Khách ${order.customer || 'Khách lẻ'}` : `Customer ${order.customer || 'Walk-in'}`}
                        </p>
                      </div>
                    </div>

                    <div className={`min-w-[124px] rounded-[18px] border px-3 py-2 text-right ${isDark ? 'border-white/10 bg-black/25' : 'border-zinc-200 bg-white/80'}`}>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                        {lang === 'vi' ? 'Tổng tiền' : 'Total'}
                      </p>
                      <p className="mt-1 text-lg font-black text-orange-400 md:text-[1.6rem]">
                        {formatVND(order.total || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2 grid-cols-3">
                    <div className={`rounded-[16px] border px-3 py-2 ${isDark ? 'border-white/10 bg-black/20' : 'border-zinc-200 bg-white/80'}`}>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                        {lang === 'vi' ? 'Bàn / tầng' : 'Table / floor'}
                      </p>
                      <p className="mt-1 text-sm font-bold md:text-base">
                        {order.table || '--'}{order.floor ? ` • ${lang === 'vi' ? `Tầng ${order.floor}` : `Floor ${order.floor}`}` : ''}
                      </p>
                    </div>

                    <div className={`rounded-[16px] border px-3 py-2 ${isDark ? 'border-white/10 bg-black/20' : 'border-zinc-200 bg-white/80'}`}>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                        {lang === 'vi' ? 'Thời gian' : 'Time'}
                      </p>
                      <p className="mt-1 text-sm font-bold md:text-base">
                        {new Date(order.createdAt).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                      </p>
                      <p className={`text-xs md:text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {new Date(order.createdAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                      </p>
                    </div>

                    <div className={`rounded-[16px] border px-3 py-2 ${isDark ? 'border-white/10 bg-black/20' : 'border-zinc-200 bg-white/80'}`}>
                      <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                        {lang === 'vi' ? 'Tổng món' : 'Total items'}
                      </p>
                      <p className="mt-1 text-sm font-bold md:text-base">{totalItems}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2 grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setDetailOrder(order)}
                      className={`inline-flex h-12 items-center justify-center rounded-2xl border px-3 text-center text-sm font-semibold transition ${
                        isDark
                          ? 'border-white/10 bg-black/25 text-white hover:bg-black/40'
                          : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50'
                      }`}
                    >
                      {lang === 'vi' ? 'Xem' : 'View'}
                    </button>
                    <a
                      href={payUrl(order.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-emerald-500 px-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    >
                      {lang === 'vi' ? 'Thanh toán' : 'Pay'}
                    </a>

                    <button
                      type="button"
                      onClick={() => printOrder(order)}
                      className="h-12 rounded-2xl bg-blue-600 px-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                    >
                      {lang === 'vi' ? 'In phiếu' : 'Print'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={`rounded-[28px] border border-dashed p-12 text-center ${isDark ? 'border-zinc-800 bg-zinc-900/40 text-zinc-400' : 'border-zinc-300 bg-zinc-50 text-zinc-500'}`}>
            {lang === 'vi' ? 'Không có đơn hàng trong ngày được chọn.' : 'No orders for the selected day.'}
          </div>
        )}

        {detailOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className={`w-full max-w-3xl rounded-[28px] border p-5 shadow-2xl ${isDark ? 'border-zinc-700 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {lang === 'vi' ? 'Chi tiết đơn' : 'Order details'}
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    {lang === 'vi' ? 'Đơn' : 'Order'} #{detailOrder.id}
                  </h3>
                  <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {lang === 'vi' ? `Khách ${detailOrder.customer || 'Khách lẻ'}` : `Customer ${detailOrder.customer || 'Walk-in'}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailOrder(null)}
                  className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-sm font-semibold ${isDark ? 'border-zinc-700 bg-zinc-900 text-zinc-200' : 'border-zinc-300 bg-zinc-100 text-zinc-700'}`}
                >
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{lang === 'vi' ? 'Trạng thái' : 'Status'}</p>
                  <p className="mt-2 text-sm font-bold">{detailOrder.status}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{lang === 'vi' ? 'Bàn / tầng' : 'Table / floor'}</p>
                  <p className="mt-2 text-sm font-bold">
                    {detailOrder.table || '--'}{detailOrder.floor ? ` • ${lang === 'vi' ? `Tầng ${detailOrder.floor}` : `Floor ${detailOrder.floor}`}` : ''}
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{lang === 'vi' ? 'Thời gian' : 'Time'}</p>
                  <p className="mt-2 text-sm font-bold">{new Date(detailOrder.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{lang === 'vi' ? 'Tổng tiền' : 'Total'}</p>
                  <p className="mt-2 text-xl font-black text-orange-400">{formatVND(detailOrder.total || 0)}</p>
                </div>
              </div>

              <div className={`mt-4 rounded-[24px] border p-4 ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50'}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-base font-semibold">{lang === 'vi' ? 'Danh sách món' : 'Items'}</p>
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {detailOrder.items.reduce((sum, item) => sum + item.qty, 0)} {lang === 'vi' ? 'món' : 'items'}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {detailOrder.items.map(item => {
                    const menu = menuItems.find(menuEntry => menuEntry.id === item.id);
                    const name = menu ? (lang === 'vi' ? menu.nameVi : menu.nameEn) : item.id;
                    return (
                      <div
                        key={`${detailOrder.id}-${item.id}`}
                        className={`rounded-2xl px-4 py-3 text-sm font-medium ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-700'}`}
                      >
                        {name} x{item.qty}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <a
                  href={payUrl(detailOrder.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  {lang === 'vi' ? 'Thanh toán' : 'Pay'}
                </a>
                <button
                  type="button"
                  onClick={() => printOrder(detailOrder)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                >
                  {lang === 'vi' ? 'In phiếu' : 'Print'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const LegacyOrderPanel: React.FC<{
    orders: OrderType[];
    setOrders: React.Dispatch<React.SetStateAction<OrderType[]>>;
    viewMode: HistoryViewMode;
    selectedDate: string;
    onViewModeChange: (mode: HistoryViewMode) => void;
    onSelectedDateChange: (value: string) => void;
  }> = ({orders, setOrders, viewMode, selectedDate, onViewModeChange, onSelectedDateChange}) => {
    const todayKey = getDateInputValue(new Date());

    const filteredOrders = orders.filter(order => {
      const activeDate = viewMode === 'today' ? todayKey : selectedDate;
      return isSameDate(order.createdAt, activeDate);
    });

    const counts = filteredOrders.reduce((acc, o) => {
      const s = o.status;
      if (s === 'Chờ xử lý' || s === 'Processing') acc.processing++;
      if (s === 'Đang nấu' || s === 'Cooking') acc.cooking++;
      if (s === 'Đã nấu xong' || s === 'Cooked') acc.cooked++;
      if (s === 'Từ chối' || s === 'Rejected') acc.rejected++;
      if (s === 'Đã phục vụ' || s === 'Served') acc.served++;
      if (s === 'Đã thanh toán' || s === 'Paid') acc.paid++;
      return acc;
    }, {processing:0, cooking:0, cooked:0, rejected:0, served:0, paid:0});

    const updateStatus = async (id:string, newStatus:string) => {
      setOrders(o => o.map(x => {
        if (x.id !== id) return x;
        const next = { ...x, status: newStatus };
        if ((newStatus === 'Đã thanh toán' || newStatus === 'Paid') && !next.deducted) {
          subtractInventoryForOrder(next);
          next.deducted = true;
        }
        return next;
      }));

      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus })
        });
      } catch (err) {
        console.error('Failed to update order status', err);
      }
    };

    const updateHandler = async (id: string, handler: string) => {
      setOrders(o => o.map(x => x.id === id ? {...x, handler } : x));
      try {
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, handler })
        });
      } catch (err) {
        console.error('Failed to update handler', err);
      }
    };

    const printOrder = (order: OrderType) => {
      const text = order.items.map(i => {
        const m = menuItems.find(m => m.id === i.id);
        const name = m ? (lang === 'vi' ? m.nameVi : m.nameEn) : i.id;
        return `${name} x${i.qty}`;
      }).join('\n');
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<pre>${t[lang].management} - ${t[lang].orders}\n\n`);
      win.document.write(`Table: ${order.table} (Floor ${order.floor})\n`);
      win.document.write(`Customer: ${order.customer}\n`);
      win.document.write(`Items:\n${text}\n\n`);
      win.document.write(`Total: ${formatVND(order.total || 0)}\n`);
      win.document.write(`
`);
      win.document.write(`<script>window.print();window.onafterprint=function(){window.close();}</script>`);
      win.document.close();
    };

    const [origin, setOrigin] = useState('');

    useEffect(() => {
      if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const statuses = [
      lang === 'vi' ? 'Chờ xử lý' : 'Processing',
      lang === 'vi' ? 'Đang nấu' : 'Cooking',
      lang === 'vi' ? 'Đã nấu xong' : 'Cooked',
      lang === 'vi' ? 'Từ chối' : 'Rejected',
      lang === 'vi' ? 'Đã phục vụ' : 'Served',
      lang === 'vi' ? 'Đã thanh toán' : 'Paid'
    ];

    const payUrl = (id: string) => `${origin}/pay/${id}`;

    return (
      <div className="space-y-6">
        <div className={`rounded-2xl border p-3 md:p-4 ${isDark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className={`inline-flex w-fit rounded-2xl p-1 ${isDark ? 'bg-zinc-950/80' : 'bg-white shadow-sm'}`}>
          <button type="button" onClick={() => onViewModeChange('today')} className={`rounded-xl px-4 py-2 transition ${viewMode === 'today' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
            {lang === 'vi' ? 'Đơn hôm nay' : 'Today orders'}
          </button>
          <button type="button" onClick={() => onViewModeChange('history')} className={`rounded-xl px-4 py-2 transition ${viewMode === 'history' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}>
            {lang === 'vi' ? 'Xem lịch sử' : 'History'}
          </button>
            </div>
            {viewMode === 'history' && (
              <label className="flex items-center gap-3">
                <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {lang === 'vi' ? 'Chọn ngày' : 'Choose date'}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => onSelectedDateChange(e.target.value)}
                  className={`rounded-xl border px-4 py-2 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                />
              </label>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {Object.entries(counts).map(([k,v]) => {
            const labelMap: Record<string,string> = {
              processing: lang==='vi'?'Chờ xử lý':'Processing',
              cooking: lang==='vi'?'Đang nấu':'Cooking',
              cooked: lang==='vi'?'Đã nấu xong':'Cooked',
              rejected: lang==='vi'?'Từ chối':'Rejected',
              served: lang==='vi'?'Đã phục vụ':'Served',
              paid: lang==='vi'?'Đã thanh toán':'Paid'
            };
            return <span key={k} className="px-3 py-1 bg-linear-to-r from-blue-500 to-cyan-500 text-white rounded shadow-sm">{labelMap[k]}: {v}</span>;
          })}
        </div>
          <table className={`w-full text-sm border-collapse ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          <thead>
            <tr className="border-b">
              <th className="p-2">{lang==='vi'?'Bàn':'Table'}</th>
              <th className="p-2">{lang==='vi'?'Khách hàng':'Customer'}</th>
              <th className="p-2">{lang==='vi'?'Món ăn':'Items'}</th>
              <th className="p-2">{lang==='vi'?'Tổng':'Total'}</th>
              <th className="p-2">{lang==='vi'?'Trạng thái':'Status'}</th>
              <th className="p-2">{lang==='vi'?'Nhân viên':'Employee'}</th>
              <th className="p-2">{lang==='vi'?'Thời gian':'Time'}</th>
              <th className="p-2">{lang==='vi'?'Thanh toán':'Pay'}</th>
              <th className="p-2">{lang==='vi'?'In':'Print'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
              const itemText = o.items.map(i => {
                const m = menuItems.find(m => m.id === i.id);
                const name = m ? (lang === 'vi' ? m.nameVi : m.nameEn) : i.id;
                return `${name} x${i.qty}`;
              }).join(', ');
              return (
                <tr key={o.id} className={`border-b ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                  <td className="p-2">{o.table}</td>
                  <td className="p-2">{o.customer}</td>
                  <td className="p-2" title={itemText}>{itemText}</td>
                  <td className="p-2">{formatVND(o.total || 0)}</td>
                  <td className="p-2">
                    <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} className={`${isDark ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-white text-zinc-900 border border-zinc-300'} p-1 rounded` }>
                      {statuses.map(s=> <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select value={o.handler} onChange={e=>updateHandler(o.id, e.target.value)} className={`${isDark ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-white text-zinc-900 border border-zinc-300'} p-1 rounded` }>
                      <option value="">--</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.name}>{acc.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="p-2">
                    <a href={payUrl(o.id)} target="_blank" rel="noreferrer" className="text-xs underline">
                      {lang === 'vi' ? 'Thanh toán' : 'Pay'}
                    </a>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => printOrder(o)}
                      className="text-xs underline"
                    >{lang === 'vi' ? 'In' : 'Print'}</button>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center opacity-70">
                  {lang === 'vi' ? 'Không có đơn hàng trong ngày được chọn.' : 'No orders for the selected day.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const OverviewPanel: React.FC<{orders: OrderType[]}> = ({orders}) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const todayPaidOrders = orders.filter(o => {
      const createdAt = new Date(o.createdAt);
      const isToday = createdAt >= startOfDay && createdAt <= endOfDay;
      const isPaid = o.status === 'Đã thanh toán' || o.status === 'Paid';
      return isToday && isPaid;
    });

    const todayRevenue = todayPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayBills = todayPaidOrders.length;

    const itemCounts: Record<string, number> = {};
    todayPaidOrders.forEach(order => {
      order.items?.forEach(item => {
        itemCounts[item.id] = (itemCounts[item.id] || 0) + item.qty;
      });
    });

    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const pieLabels = topItems.map(([id]) => {
      const menu = menuItems.find(m => m.id === id);
      return menu ? (lang === 'vi' ? menu.nameVi : (menu.nameEn || menu.nameVi)) : id;
    });

    const pieData = topItems.map(([, qty]) => qty);

    const itemChartData = {
      labels: pieLabels.length ? pieLabels : [lang === 'vi' ? 'Chưa có dữ liệu' : 'No data'],
      datasets: [
        {
          label: lang === 'vi' ? 'Số lượng bán' : 'Sold quantity',
          data: pieData.length ? pieData : [1],
          backgroundColor: pieLabels.length
            ? pieLabels.map((_, i) => ['#f97316', '#3b82f6', '#10b981', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'][i % 8])
            : ['#52525b'],
          borderWidth: 2,
          borderColor: isDark ? '#09090b' : '#ffffff',
        },
      ],
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-4 mb-4">
          <div className={`p-4 rounded flex-1 ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 border border-zinc-200'}`}>
            <h3 className="text-sm">{lang==='vi'?'Doanh thu hôm nay':'Today revenue'}</h3>
            <p className="text-2xl font-bold">{formatVND(todayRevenue)}</p>
          </div>
          <div className={`p-4 rounded flex-1 ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 border border-zinc-200'}`}>
            <h3 className="text-sm">{lang==='vi'?'Bill đã thanh toán hôm nay':'Paid bills today'}</h3>
            <p className="text-2xl font-bold">{todayBills}</p>
          </div>
        </div>

        <div className={`p-4 rounded ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 border border-zinc-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">{lang === 'vi' ? 'Biểu đồ tròn món bán chạy hôm nay' : 'Today best-selling items pie chart'}</h3>
              <p className="text-sm opacity-70">
                {lang === 'vi'
                  ? `Tự reset theo ngày mới (${startOfDay.toLocaleDateString('vi-VN')})`
                  : `Auto resets each new day (${startOfDay.toLocaleDateString('en-US')})`}
              </p>
            </div>
            <p className="text-xs opacity-60">{new Date().toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>
          </div>

          {topItems.length === 0 ? (
            <p className="italic text-sm">{lang === 'vi' ? 'Hôm nay chưa có món nào được thanh toán.' : 'No paid item sales yet today.'}</p>
          ) : (
            <div className="h-80">
              <Pie data={itemChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'bottom', labels: { color: isDark ? '#fff' : '#000' } },
                  tooltip: {
                    enabled: true,
                    callbacks: {
                      label: (context) => `${context.label}: ${context.parsed}`,
                    },
                  },
                  datalabels: {
                    color: '#fff',
                    formatter: (value: number) => value,
                    font: { weight: 'bold' },
                  },
                },
              }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const InventoryPanel: React.FC<{
    stock: InventoryState;
    setStock: React.Dispatch<React.SetStateAction<InventoryState>>;
    drafts: Record<string, string>;
    setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  }> = ({ stock, setStock, drafts, setDrafts }) => {
    const updateStockQuantity = (id: string, rawValue: string) => {
      setDrafts(prev => ({ ...prev, [id]: rawValue }));
    };

    const commitStockQuantity = (id: string) => {
      const rawValue = (drafts[id] ?? '0').replace(/[^\d]/g, '');
      const parsed = Number(rawValue);
      const quantity = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      const current = stock[id] || DEFAULT_INVENTORY_ENTRY;

      setStock(prev => {
        const next = {
          ...prev,
          [id]: {
            initial: quantity,
            sold: current.sold || 0,
            incoming: 0,
          },
        };
        saveInventoryStock(next);
        return next;
      });

      setDrafts(prev => ({ ...prev, [id]: String(quantity) }));
    };

    return (
      <div className="space-y-4">
        <h2 className="text-xl mb-4">{lang === 'vi' ? 'Quản lý kho' : 'Inventory Management'}</h2>
        <p className="text-sm text-zinc-200">{lang === 'vi' ? 'Nhập trực tiếp số lượng hiện có. Khi đơn được thanh toán, hệ thống sẽ tự trừ kho.' : 'Enter the current quantity directly. Paid orders will reduce stock automatically.'}</p>
        <table className="w-full table-fixed text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="w-[28%] px-3 py-3 text-left">{lang === 'vi' ? 'Món' : 'Item'}</th>
              <th className="w-[18%] px-3 py-3 text-center">{lang === 'vi' ? 'Tồn' : 'Stock'}</th>
              <th className="w-[16%] px-3 py-3 text-center">{lang === 'vi' ? 'Đã bán' : 'Sold'}</th>
              <th className="w-[16%] px-3 py-3 text-center">{lang === 'vi' ? 'Hiện còn' : 'Remaining'}</th>
              <th className="w-[22%] px-3 py-3 text-center">{lang === 'vi' ? 'Trạng thái' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map(item => {
              const s = stock[item.id] || DEFAULT_INVENTORY_ENTRY;
              const remaining = getInventoryQuantity(s);
              return (
                <tr key={item.id} className="border-b hover:bg-zinc-900">
                  <td className="px-3 py-3 align-middle">{lang === 'vi' ? item.nameVi : item.nameEn}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={drafts[item.id] ?? String(s.initial)}
                      onChange={e => updateStockQuantity(item.id, e.target.value)}
                      onFocus={e => e.currentTarget.select()}
                      onBlur={() => commitStockQuantity(item.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitStockQuantity(item.id);
                          e.currentTarget.blur();
                        }
                      }}
                      className="mx-auto block w-36 rounded-xl border border-zinc-600 bg-zinc-700 px-3 py-2 text-center text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                    />
                  </td>
                  <td className="px-3 py-3 text-center align-middle">{s.sold}</td>
                  <td className="px-3 py-3 text-center align-middle font-semibold">{remaining}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${remaining > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {remaining > 0 ? (lang === 'vi' ? 'Còn hàng' : 'In stock') : lang === 'vi' ? 'Hết hàng' : 'Out of stock'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const TablePanel: React.FC<{
    lang: 'vi' | 'en';
    isDark: boolean;
    tables: TableInfo[];
    saveTables: (tables: TableInfo[]) => void;
  }> = ({ lang, isDark, tables, saveTables }) => {
    const [tableNumber, setTableNumber] = useState('');
    const [floor, setFloor] = useState('1');
    const [origin, setOrigin] = useState('');
    const [tableMessage, setTableMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    useEffect(() => {
      if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const makeQrUrl = (table: string, tableFloor: string) => `${origin}/?table=${table}&floor=${tableFloor}`;

    const showTableMessage = (type: 'success' | 'error' | 'info', text: string) => {
      setTableMessage({ type, text });
    };

    const createTable = () => {
      const normalizedFloor = floor.trim();
      const normalizedTable = tableNumber.trim().padStart(2, '0');
      if (!normalizedTable || !normalizedFloor) {
        showTableMessage('error', lang === 'vi' ? 'Vui lòng nhập số bàn và tầng.' : 'Please enter both table number and floor.');
        return;
      }

      const id = `${normalizedFloor}-${normalizedTable}`;
      if (tables.some(table => table.id === id)) {
        showTableMessage('error', lang === 'vi' ? 'Bàn này đã có QR rồi.' : 'This table already has a QR code.');
        return;
      }

      const next = [
        {
          id,
          table: normalizedTable,
          floor: normalizedFloor,
          qr: makeQrUrl(normalizedTable, normalizedFloor),
          active: true,
          status: 'empty' as const,
        },
        ...tables,
      ].sort((a, b) => {
        const floorCompare = a.floor.localeCompare(b.floor, undefined, { numeric: true });
        if (floorCompare !== 0) return floorCompare;
        return a.table.localeCompare(b.table, undefined, { numeric: true });
      });

      saveTables(next);
      setTableNumber('');
      showTableMessage('success', lang === 'vi' ? `Đã tạo QR cho bàn ${normalizedTable}, tầng ${normalizedFloor}.` : `QR created for table ${normalizedTable}, floor ${normalizedFloor}.`);
    };

    const regenerateQrs = () => {
      const next = tables.map(table => ({ ...table, qr: makeQrUrl(table.table, table.floor) }));
      saveTables(next);
      showTableMessage('success', lang === 'vi' ? 'Đã cập nhật lại toàn bộ link QR.' : 'All QR links were refreshed.');
    };

    const toggleActive = (id: string) => {
      saveTables(tables.map(table => (table.id === id ? { ...table, active: !table.active } : table)));
    };

    const setStatus = (id: string, status: TableInfo['status']) => {
      saveTables(tables.map(table => (table.id === id ? { ...table, status } : table)));
    };

    const deleteTable = (id: string) => {
      saveTables(tables.filter(table => table.id !== id));
      showTableMessage('info', lang === 'vi' ? 'Đã xóa bàn khỏi danh sách QR.' : 'Table removed from QR list.');
    };

    const printTableQr = (table: TableInfo) => {
      if (typeof window === 'undefined') return;
      const canvas = document.getElementById(`qr-${table.id}`) as HTMLCanvasElement | null;
      const dataUrl = canvas?.toDataURL('image/png');
      const printWindow = window.open('', '_blank', 'width=720,height=960');
      if (!printWindow || !dataUrl) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>QR Table ${table.table}</title>
            <style>
              body { margin: 0; font-family: Arial, sans-serif; background: #111827; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .sheet { width: 360px; padding: 32px; border-radius: 28px; background: #18181b; border: 1px solid #3f3f46; text-align: center; }
              .badge { display: inline-block; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(249,115,22,0.35); color: #fdba74; margin-bottom: 20px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 700; }
              img { width: 220px; height: 220px; border-radius: 24px; background: white; padding: 16px; }
              .title { font-size: 34px; font-weight: 800; margin: 0; }
              .subtitle { margin: 10px 0 24px; font-size: 16px; color: #d4d4d8; }
              .url { margin-top: 18px; font-size: 12px; color: #a1a1aa; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="badge">HCH RESTO QR</div>
              <h1 class="title">Bàn ${table.table}</h1>
              <p class="subtitle">Tầng ${table.floor}</p>
              <img src="${dataUrl}" alt="QR Table ${table.table}" />
              <p class="url">${table.qr}</p>
            </div>
            <script>
              window.onload = function () {
                window.print();
                window.onafterprint = function () { window.close(); };
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    const downloadTablePng = (table: TableInfo) => {
      if (typeof window === 'undefined') return;
      const canvas = document.getElementById(`qr-${table.id}`) as HTMLCanvasElement | null;
      const dataUrl = canvas?.toDataURL('image/png');
      if (!dataUrl) return;

      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `hch-resto-ban-${table.table}-tang-${table.floor}.png`;
      anchor.click();
    };

    const activeCount = tables.filter(table => table.active).length;
    const emptyCount = tables.filter(table => table.status === 'empty').length;

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                {lang === 'vi' ? 'QR bàn ăn' : 'Table QR'}
              </span>
              <div>
                <h2 className="text-3xl font-extrabold text-white">{lang === 'vi' ? 'Tạo QR từng bàn riêng lẻ' : 'Generate QR per table'}</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  {lang === 'vi'
                    ? 'Tạo từng mã QR theo số bàn và tầng, in hoặc tải PNG để dán lên từng bàn. Khách quét mã sẽ mở menu và thấy ô nhập thông tin trước khi đặt món.'
                    : 'Create QR codes by table and floor, then print or download PNG files for each table. Guests scanning the code open the menu and see the info popup first.'}
                </p>
              </div>
            </div>

            <div className="grid min-w-[280px] grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Tổng bàn' : 'Tables'}</p>
                <p className="mt-2 text-3xl font-bold text-white">{tables.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Hoạt động' : 'Active'}</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{activeCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Trống' : 'Empty'}</p>
                <p className="mt-2 text-3xl font-bold text-cyan-300">{emptyCount}</p>
              </div>
            </div>
          </div>
        </div>

        {tableMessage && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              tableMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : tableMessage.type === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
            }`}
          >
            {tableMessage.text}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
            <h3 className="text-xl font-bold text-white">{lang === 'vi' ? 'Thêm bàn mới' : 'Add new table'}</h3>
            <p className="mt-2 text-sm text-zinc-400">
              {lang === 'vi'
                ? 'Nhập đúng số bàn và tầng để tạo QR riêng cho từng bàn.'
                : 'Enter the exact table number and floor to create an individual QR code.'}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Số bàn' : 'Table number'}</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={lang === 'vi' ? 'Ví dụ: 12' : 'Example: 12'}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Tầng' : 'Floor'}</label>
                <input
                  value={floor}
                  onChange={e => setFloor(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={createTable}
                className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
              >
                {lang === 'vi' ? 'Tạo QR cho bàn này' : 'Create table QR'}
              </button>
              <button
                type="button"
                onClick={regenerateQrs}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20"
              >
                {lang === 'vi' ? 'Cập nhật lại tất cả QR' : 'Refresh all QR'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tables.map(table => (
              <div
                key={table.id}
                className={`rounded-3xl border p-5 shadow-[0_16px_48px_rgba(0,0,0,0.22)] ${isDark ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-black">{lang === 'vi' ? 'Bàn' : 'Table'} {table.table}</div>
                    <div className="mt-1 text-sm text-zinc-400">{lang === 'vi' ? 'Tầng' : 'Floor'} {table.floor}</div>
                    <div className="mt-2 text-sm">
                      {lang === 'vi' ? 'Trạng thái' : 'Status'}: <span className="font-medium">{table.status === 'empty' ? (lang === 'vi' ? 'Trống' : 'Empty') : table.status === 'occupied' ? (lang === 'vi' ? 'Có khách' : 'Occupied') : (lang === 'vi' ? 'Đang order' : 'Ordering')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(table.id)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${table.active ? 'bg-green-600 text-white' : 'bg-zinc-500 text-white'}`}
                    >
                      {table.active ? (lang === 'vi' ? 'Hoạt động' : 'Active') : (lang === 'vi' ? 'Tạm khoá' : 'Inactive')}
                    </button>
                    <select
                      value={table.status}
                      onChange={e => setStatus(table.id, e.target.value as TableInfo['status'])}
                      className={`rounded-2xl border px-3 py-2 text-sm ${isDark ? 'border-zinc-600 bg-zinc-800 text-white' : 'border-zinc-300 bg-white text-zinc-900'}`}
                    >
                      <option value="empty">{lang === 'vi' ? 'Trống' : 'Empty'}</option>
                      <option value="occupied">{lang === 'vi' ? 'Có khách' : 'Occupied'}</option>
                      <option value="ordering">{lang === 'vi' ? 'Đang order' : 'Ordering'}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-[24px] bg-white p-3">
                      <QRCodeCanvas id={`qr-${table.id}`} value={table.qr} size={112} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">{lang === 'vi' ? 'Link QR' : 'QR link'}</p>
                      <div className="mt-2 break-all text-xs text-zinc-400">{table.qr}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => printTableQr(table)}
                      className="rounded-2xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      {lang === 'vi' ? 'In QR' : 'Print'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTablePng(table)}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      {lang === 'vi' ? 'Tải PNG' : 'PNG'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTable(table.id)}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      {lang === 'vi' ? 'Xóa' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {tables.length === 0 && (
              <div className="md:col-span-2 rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center text-zinc-400">
                {lang === 'vi' ? 'Chưa có bàn nào được tạo QR. Hãy thêm bàn đầu tiên ở khối bên trái.' : 'No QR tables yet. Add your first table from the panel on the left.'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LegacyTablePanel: React.FC<{
    lang: 'vi' | 'en';
    isDark: boolean;
    tables: TableInfo[];
    saveTables: (tables: TableInfo[]) => void;
  }> = ({ lang, isDark, tables, saveTables }) => {
    const [count, setCount] = useState(tables.length);
    const [floor, setFloor] = useState('1');
    const [origin, setOrigin] = useState('');

    useEffect(() => {
      setCount(tables.length);
    }, [tables.length]);

    useEffect(() => {
      if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const makeQrUrl = (table: string, floor: string) => `${origin}/?table=${table}&floor=${floor}`;

    const createTables = () => {
      const next: TableInfo[] = [];
      for (let i = 1; i <= count; i++) {
        const tableNum = String(i).padStart(2, '0');
        const id = `${floor}-${tableNum}`;
        next.push({
          id,
          table: tableNum,
          floor,
          qr: makeQrUrl(tableNum, floor),
          active: true,
          status: 'empty',
        });
      }
      saveTables(next);
    };

    const regenerateQrs = () => {
      const next = tables.map(t => ({ ...t, qr: makeQrUrl(t.table, t.floor) }));
      saveTables(next);
    };

    const toggleActive = (id: string) => {
      const next = tables.map(t => t.id === id ? { ...t, active: !t.active } : t);
      saveTables(next);
    };

    const setStatus = (id: string, status: TableInfo['status']) => {
      const next = tables.map(t => t.id === id ? { ...t, status } : t);
      saveTables(next);
    };

    const deleteTable = (id: string) => {
      const next = tables.filter(t => t.id !== id);
      saveTables(next);
    };

    const printTableQr = (table: TableInfo) => {
      if (typeof window === 'undefined') return;
      const canvas = document.getElementById(`qr-${table.id}`) as HTMLCanvasElement | null;
      const dataUrl = canvas?.toDataURL('image/png');
      const printWindow = window.open('', '_blank', 'width=720,height=960');
      if (!printWindow || !dataUrl) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>QR Table ${table.table}</title>
            <style>
              body { margin: 0; font-family: Arial, sans-serif; background: #111827; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .sheet { width: 360px; padding: 32px; border-radius: 28px; background: #18181b; border: 1px solid #3f3f46; text-align: center; }
              .badge { display: inline-block; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(249,115,22,0.35); color: #fdba74; margin-bottom: 20px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 700; }
              img { width: 220px; height: 220px; border-radius: 24px; background: white; padding: 16px; }
              .title { font-size: 34px; font-weight: 800; margin: 0; }
              .subtitle { margin: 10px 0 24px; font-size: 16px; color: #d4d4d8; }
              .url { margin-top: 18px; font-size: 12px; color: #a1a1aa; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="badge">HCH RESTO QR</div>
              <h1 class="title">Bàn ${table.table}</h1>
              <p class="subtitle">Tầng ${table.floor}</p>
              <img src="${dataUrl}" alt="QR Table ${table.table}" />
              <p class="url">${table.qr}</p>
            </div>
            <script>
              window.onload = function () {
                window.print();
                window.onafterprint = function () { window.close(); };
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    return (
      <div className="space-y-4">
        <h2 className="text-xl mb-4">{lang === 'vi' ? 'Quản lý bàn' : 'Table management'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm">{lang === 'vi' ? 'Số bàn' : 'Table count'}</label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">{lang === 'vi' ? 'Tầng' : 'Floor'}</label>
            <input
              value={floor}
              onChange={e => setFloor(e.target.value)}
              className="w-full border p-2 rounded"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={createTables}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded"
            >
              {lang === 'vi' ? 'Tạo bàn' : 'Generate'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={regenerateQrs}
              className="w-full bg-amber-600 text-white px-4 py-2 rounded"
            >
              {lang === 'vi' ? 'Cập nhật QR' : 'Refresh QR'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tables.map(table => (
            <div
              key={table.id}
              className={`p-4 rounded ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 border border-zinc-200'}`}
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1">
                  <div className="font-bold">{lang === 'vi' ? 'Bàn' : 'Table'} {table.table}</div>
                  <div className="text-xs text-zinc-400">{lang === 'vi' ? 'Tầng' : 'Floor'} {table.floor}</div>
                  <div className="mt-1 text-xs">
                    {lang === 'vi' ? 'Trạng thái' : 'Status'}: <span className="font-medium">{table.status === 'empty' ? (lang === 'vi' ? 'Trống' : 'Empty') : table.status === 'occupied' ? (lang === 'vi' ? 'Có khách' : 'Occupied') : (lang === 'vi' ? 'Đang order' : 'Ordering')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(table.id)}
                    className={`text-xs px-2 py-1 rounded ${table.active ? 'bg-green-600 text-white' : 'bg-zinc-500 text-white'}`}
                  >
                    {table.active ? (lang === 'vi' ? 'Hoạt động' : 'Active') : (lang === 'vi' ? 'Tạm khoá' : 'Inactive')}
                  </button>
                  <select
                    value={table.status}
                    onChange={e => setStatus(table.id, e.target.value as TableInfo['status'])}
                    className={`text-xs border rounded p-1 ${isDark ? 'bg-zinc-700 text-white border-zinc-600' : 'bg-white text-zinc-900 border-zinc-300'}`}
                  >
                    <option value="empty">{lang === 'vi' ? 'Trống' : 'Empty'}</option>
                    <option value="occupied">{lang === 'vi' ? 'Có khách' : 'Occupied'}</option>
                    <option value="ordering">{lang === 'vi' ? 'Đang order' : 'Ordering'}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => printTableQr(table)}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                  >
                    {lang === 'vi' ? 'In QR' : 'Print'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTable(table.id)}
                    className="text-xs px-2 py-1 rounded bg-red-600 text-white"
                  >
                    {lang === 'vi' ? 'Xóa' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <QRCodeCanvas id={`qr-${table.id}`} value={table.qr} size={88} />
                <div className="text-xs break-all">{table.qr}</div>
              </div>
            </div>
          ))}
        </div>
      {/* QR Table Print Modal Disabled */}
    </div>
    );
  };

const AccountsPanel: React.FC<{
  accounts: StaffAccount[];
  currentUserId: string;
  refreshAccounts: () => Promise<void>;
}> = ({ accounts, currentUserId, refreshAccounts }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [msg, setMsg] = useState('');

    const currentAdmin = accounts.find(acc => acc.id === currentUserId);

    useEffect(() => {
      if (currentAdmin) {
        setEmail(currentAdmin.email || '');
        setTwoFactorEnabled(Boolean(currentAdmin.twoFactorEnabled));
      }
    }, [currentAdmin]);


    const addAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!username || !password || !name) {
        setMsg(lang === 'vi' ? 'Vui lòng điền đầy đủ' : 'Please fill all fields');
        return;
      }

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, email: '', twoFactorEnabled: false, role: 'staff' }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || (lang === 'vi' ? 'Không thể tạo tài khoản.' : 'Unable to create account.'));
        return;
      }

      await refreshAccounts();
      setUsername(''); setPassword(''); setName('');
      setMsg(lang === 'vi' ? 'Thêm thành công' : 'Added successfully');
    };

    const sendTestOtpEmail = async () => {
      setMsg('');
      const res = await fetch('/api/auth/test-otp', {
        method: 'POST',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || (lang === 'vi' ? 'Không thể gửi email OTP thử.' : 'Unable to send OTP test email.'));
        return;
      }

      setMsg(
        lang === 'vi'
          ? `Đã gửi email OTP thử tới ${data.email}.`
          : `OTP test email sent to ${data.email}.`
      );
    };

    const saveAdminSecurity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentAdmin) return;

      const res = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentAdmin.id,
          email,
          twoFactorEnabled,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || (lang === 'vi' ? 'Không thể lưu cấu hình bảo mật.' : 'Unable to save security settings.'));
        return;
      }

      await refreshAccounts();
      setMsg(lang === 'vi' ? 'Đã lưu email và xác thực 2 lớp cho admin.' : 'Admin email and 2FA settings saved.');
    };

    const deleteAccount = async (id: string) => {
      const res = await fetch('/api/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchAccounts();
      }
    };

    return (
      <div className="space-y-4">
        <h2 className="text-xl mb-4">{lang === 'vi' ? 'Quản lý tài khoản order' : 'Order Accounts Management'}</h2>
        {currentAdmin && (
          <form onSubmit={saveAdminSecurity} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-sm">{lang === 'vi' ? 'Email nhận mã 2 lớp của admin' : 'Admin email for OTP'}</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-2 rounded" />
            </div>
            <label className="flex items-center gap-3 pt-6">
              <input type="checkbox" checked={twoFactorEnabled} onChange={e => setTwoFactorEnabled(e.target.checked)} />
              <span>{lang === 'vi' ? 'Bật xác thực 2 lớp' : 'Enable two-factor authentication'}</span>
            </label>
            <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded md:col-span-3">
              {lang === 'vi' ? 'Lưu bảo mật admin' : 'Save admin security'}
            </button>
            <button
              type="button"
              onClick={sendTestOtpEmail}
              className="bg-blue-600 text-white px-4 py-2 rounded md:col-span-3"
            >
              {lang === 'vi' ? 'Gửi thử email OTP' : 'Send test OTP email'}
            </button>
          </form>
        )}

        <form onSubmit={addAccount} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm">{lang === 'vi' ? 'Tên đăng nhập' : 'Username'}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">{lang === 'vi' ? 'Mật khẩu' : 'Password'}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm">{lang === 'vi' ? 'Tên' : 'Name'}</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded col-span-full">{lang === 'vi' ? 'Thêm tài khoản' : 'Add Account'}</button>
        </form>
        {msg && <p className="text-green-500">{msg}</p>}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="p-2">{lang === 'vi' ? 'Tên đăng nhập' : 'Username'}</th>
              <th className="p-2">{lang === 'vi' ? 'Tên' : 'Name'}</th>
              <th className="p-2">{lang === 'vi' ? 'Vai trò' : 'Role'}</th>
              <th className="p-2">Email</th>
              <th className="p-2">2FA</th>
              <th className="p-2">{lang === 'vi' ? 'Hành động' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id} className="border-b hover:bg-zinc-900">
                <td className="p-2">{acc.username}</td>
                <td className="p-2">{acc.name}</td>
                <td className="p-2">{acc.role}</td>
                <td className="p-2">{acc.email || '--'}</td>
                <td className="p-2">{acc.twoFactorEnabled ? 'On' : 'Off'}</td>
                <td className="p-2">
                  {acc.id !== currentUserId && (
                    <button onClick={() => deleteAccount(acc.id)} className="text-red-500 underline">{lang === 'vi' ? 'Xóa' : 'Delete'}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const AccountsPanelPro: React.FC<{
    accounts: StaffAccount[];
    currentUserId: string;
    refreshAccounts: () => Promise<void>;
  }> = ({ accounts, currentUserId, refreshAccounts }) => {
    const [staffUsername, setStaffUsername] = useState('');
    const [staffPassword, setStaffPassword] = useState('');
    const [staffName, setStaffName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPhone, setAdminPhone] = useState('');
    const [adminTwoFactorEnabled, setAdminTwoFactorEnabled] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [isSavingSecurity, setIsSavingSecurity] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [isSendingOtpTest, setIsSendingOtpTest] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const currentAdmin = accounts.find(acc => acc.id === currentUserId);
    const staffAccounts = accounts.filter(acc => acc.role !== 'admin');

    useEffect(() => {
      if (currentAdmin) {
        setAdminEmail(currentAdmin.email || '');
        setAdminPhone(currentAdmin.phone || '');
        setAdminTwoFactorEnabled(Boolean(currentAdmin.twoFactorEnabled));
      }
    }, [currentAdmin]);

    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
      setMsg({ type, text });
    };

    const addAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      setMsg(null);

      if (!staffUsername.trim() || !staffPassword.trim() || !staffName.trim()) {
        showMessage('error', lang === 'vi' ? 'Vui lòng nhập đầy đủ tên đăng nhập, mật khẩu và tên hiển thị.' : 'Please complete username, password and display name.');
        return;
      }

      setIsCreatingAccount(true);
      try {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: staffUsername.trim(),
            password: staffPassword.trim(),
            name: staffName.trim(),
            email: '',
            phone: '',
            twoFactorEnabled: false,
            role: 'staff',
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showMessage('error', data.error || (lang === 'vi' ? 'Không thể tạo tài khoản nhân viên.' : 'Unable to create staff account.'));
          return;
        }

        await refreshAccounts();
        setStaffUsername('');
        setStaffPassword('');
        setStaffName('');
        showMessage('success', lang === 'vi' ? 'Đã thêm tài khoản nhân viên mới.' : 'Staff account created successfully.');
      } finally {
        setIsCreatingAccount(false);
      }
    };

    const sendTestOtpEmail = async () => {
      setMsg(null);
      setIsSendingOtpTest(true);

      try {
        const res = await fetch('/api/auth/test-otp', { method: 'POST' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          showMessage('error', data.error || (lang === 'vi' ? 'Không thể gửi email OTP thử.' : 'Unable to send OTP test email.'));
          return;
        }

        showMessage('success', lang === 'vi' ? `Đã gửi email OTP thử tới ${data.email}.` : `OTP test email sent to ${data.email}.`);
      } finally {
        setIsSendingOtpTest(false);
      }
    };

    const saveAdminSecurity = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentAdmin) return;

      const trimmedEmail = adminEmail.trim();
      const trimmedPhone = adminPhone.trim();
      if (adminTwoFactorEnabled && !trimmedEmail) {
        showMessage('error', lang === 'vi' ? 'Cần nhập email admin trước khi bật xác thực 2 lớp.' : 'Admin email is required before enabling 2FA.');
        return;
      }

      setMsg(null);
      setIsSavingSecurity(true);
      try {
        const res = await fetch('/api/accounts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentAdmin.id,
            email: trimmedEmail,
            phone: trimmedPhone,
            twoFactorEnabled: adminTwoFactorEnabled,
            password: adminPassword.trim() || undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showMessage('error', data.error || (lang === 'vi' ? 'Không thể lưu cấu hình bảo mật admin.' : 'Unable to save admin security settings.'));
          return;
        }

        await refreshAccounts();
        setAdminPassword('');
        showMessage(
          'success',
          adminTwoFactorEnabled
            ? (lang === 'vi' ? 'Đã lưu email admin và bật xác thực 2 lớp.' : 'Admin email saved and 2FA enabled.')
            : (lang === 'vi' ? 'Đã cập nhật cấu hình tài khoản admin.' : 'Admin account settings updated.')
        );
      } finally {
        setIsSavingSecurity(false);
      }
    };

    const deleteAccount = async (id: string) => {
      setMsg(null);
      setDeletingId(id);

      try {
        const res = await fetch('/api/accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showMessage('error', data.error || (lang === 'vi' ? 'Không thể xóa tài khoản.' : 'Unable to delete account.'));
          return;
        }

        await refreshAccounts();
        showMessage('success', lang === 'vi' ? 'Đã xóa tài khoản nhân viên.' : 'Staff account deleted.');
      } finally {
        setDeletingId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                {lang === 'vi' ? 'Bảo mật quản trị' : 'Admin security'}
              </span>
              <div>
                <h2 className="text-3xl font-extrabold text-white">{lang === 'vi' ? 'Quản lý tài khoản' : 'Account Management'}</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  {lang === 'vi'
                    ? 'Quản lý tài khoản nhân viên, email nhận OTP và lớp bảo mật đăng nhập cho trang admin ở cùng một nơi.'
                    : 'Manage staff accounts, OTP delivery email, and admin login protection in one place.'}
                </p>
              </div>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang === 'vi' ? 'Tài khoản' : 'Accounts'}</p>
                <p className="mt-2 text-3xl font-bold text-white">{accounts.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">2FA</p>
                <p className={`mt-2 text-xl font-bold ${currentAdmin?.twoFactorEnabled ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {currentAdmin?.twoFactorEnabled ? (lang === 'vi' ? 'Đang bật' : 'Enabled') : (lang === 'vi' ? 'Đang tắt' : 'Disabled')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {msg && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              msg.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : msg.type === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
          <form onSubmit={saveAdminSecurity} className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">{lang === 'vi' ? 'Bảo mật tài khoản admin' : 'Admin security'}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {lang === 'vi'
                    ? 'Lưu email OTP, số điện thoại chủ và lớp bảo mật đăng nhập cho tài khoản admin.'
                    : 'Manage the OTP email, owner phone number, and login protection for the admin account.'}
                </p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${adminTwoFactorEnabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}`}>
                {adminTwoFactorEnabled ? '2FA ON' : '2FA OFF'}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{lang === 'vi' ? 'Tài khoản admin' : 'Admin account'}</p>
                <p className="mt-2 text-base font-semibold text-white">{currentAdmin?.username || 'admin'}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">Email OTP</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  autoComplete="off"
                  placeholder="admin@gmail.com"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Số điện thoại chủ' : 'Owner phone'}</label>
                <input
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value.replace(/[^\d+\s]/g, ''))}
                  autoComplete="off"
                  placeholder={lang === 'vi' ? 'Nhập số điện thoại chủ' : 'Enter owner phone'}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-zinc-200">
                  {lang === 'vi' ? 'Mật khẩu admin mới' : 'New admin password'}
                  <span className="ml-2 text-xs text-zinc-500">{lang === 'vi' ? '(không bắt buộc)' : '(optional)'}</span>
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={lang === 'vi' ? 'Để trống nếu không đổi mật khẩu' : 'Leave blank to keep current password'}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-white">{lang === 'vi' ? 'Xác thực 2 lớp cho admin' : 'Two-factor authentication'}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {lang === 'vi'
                    ? 'Khuyến nghị bật sau khi đã kiểm tra gửi email OTP thành công.'
                    : 'Recommended after confirming OTP emails are sent successfully.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminTwoFactorEnabled(prev => !prev)}
                className={`inline-flex min-w-[120px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                  adminTwoFactorEnabled
                    ? 'bg-emerald-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {adminTwoFactorEnabled ? (lang === 'vi' ? 'Đang bật' : 'Enabled') : (lang === 'vi' ? 'Bật 2FA' : 'Enable 2FA')}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSavingSecurity}
                className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSecurity ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu cấu hình admin' : 'Save admin settings')}
              </button>
              <button
                type="button"
                onClick={sendTestOtpEmail}
                disabled={isSendingOtpTest || !adminEmail.trim()}
                className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingOtpTest ? (lang === 'vi' ? 'Đang gửi...' : 'Sending...') : (lang === 'vi' ? 'Gửi thử email OTP' : 'Send test OTP email')}
              </button>
            </div>
          </form>

          <form onSubmit={addAccount} className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
            <h3 className="text-xl font-bold text-white">{lang === 'vi' ? 'Thêm tài khoản nhân viên' : 'Create staff account'}</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {lang === 'vi'
                ? 'Tạo tài khoản nhân viên order riêng, không ảnh hưởng tài khoản admin.'
                : 'Create a dedicated order staff account without affecting the admin account.'}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Tên đăng nhập' : 'Username'}</label>
                <input value={staffUsername} onChange={e => setStaffUsername(e.target.value)} autoComplete="off" name="staff_username_new" placeholder={lang === 'vi' ? 'Ví dụ: order-ca-2' : 'Example: order-shift-2'} className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Mật khẩu' : 'Password'}</label>
                <input type="password" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} autoComplete="new-password" name="staff_password_new" className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-200">{lang === 'vi' ? 'Tên hiển thị' : 'Display name'}</label>
                <input value={staffName} onChange={e => setStaffName(e.target.value)} autoComplete="off" name="staff_display_name" className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-orange-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingAccount}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingAccount ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...') : (lang === 'vi' ? 'Thêm tài khoản nhân viên' : 'Create staff account')}
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
            <div>
              <h3 className="text-lg font-bold text-white">{lang === 'vi' ? 'Danh sách tài khoản' : 'Account list'}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {lang === 'vi'
                  ? 'Theo dõi nhanh vai trò, email, số điện thoại và trạng thái bảo mật của từng tài khoản.'
                  : 'Quickly review roles, emails, phone numbers, and security status for each account.'}
              </p>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300">
              {accounts.length} {lang === 'vi' ? 'tài khoản' : 'accounts'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-950/80 text-zinc-400">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">{lang === 'vi' ? 'Tài khoản' : 'Account'}</th>
                  <th className="px-6 py-4 text-left font-medium">Email</th>
                  <th className="px-6 py-4 text-left font-medium">{lang === 'vi' ? 'SĐT' : 'Phone'}</th>
                  <th className="px-6 py-4 text-left font-medium">{lang === 'vi' ? 'Vai trò' : 'Role'}</th>
                  <th className="px-6 py-4 text-left font-medium">2FA</th>
                  <th className="px-6 py-4 text-right font-medium">{lang === 'vi' ? 'Thao tác' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-t border-zinc-800 text-zinc-200">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{acc.name}</span>
                        <span className="text-xs text-zinc-500">@{acc.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">{acc.email || '--'}</td>
                    <td className="px-6 py-4 text-zinc-300">{acc.phone || '--'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${acc.role === 'admin' ? 'bg-orange-500/15 text-orange-300' : 'bg-blue-500/15 text-blue-300'}`}>
                        {acc.role === 'admin' ? 'Admin' : (lang === 'vi' ? 'Nhân viên' : 'Staff')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${acc.twoFactorEnabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}`}>
                        {acc.twoFactorEnabled ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {acc.id === currentUserId ? (
                        <span className="text-xs text-zinc-500">{lang === 'vi' ? 'Tài khoản đang dùng' : 'Current account'}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={deletingId === acc.id}
                          onClick={() => deleteAccount(acc.id)}
                          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === acc.id ? (lang === 'vi' ? 'Đang xóa...' : 'Deleting...') : (lang === 'vi' ? 'Xóa' : 'Delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                      {lang === 'vi' ? 'Chưa có tài khoản nào trong hệ thống.' : 'No accounts found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {staffAccounts.length === 0 && (
            <div className="border-t border-zinc-800 px-6 py-4 text-sm text-zinc-500">
              {lang === 'vi'
                ? 'Hiện tại chỉ có tài khoản admin. Bạn có thể tạo thêm tài khoản nhân viên ở khối bên trên.'
                : 'Only the admin account exists right now. You can create staff accounts in the panel above.'}
            </div>
          )}
        </div>
      </div>
    );
  };

  const NoAccess: React.FC<{ feature: string }> = ({ feature }) => (
    <div className={`p-6 rounded ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 border border-zinc-200'}`}>
      <p className="text-lg font-semibold">{lang === 'vi' ? 'Không có quyền' : 'No access'}</p>
      <p className="mt-2 text-sm">
        {lang === 'vi'
          ? `Bạn cần quyền admin để truy cập ${feature}.`
          : `You need admin access to view ${feature}.`}
      </p>
    </div>
  );

  const renderContent = () => {
    switch (panel) {
      case 'dashboard': return <DashboardPanel orders={orders} menuItems={menuItems} inventoryStock={inventoryStock} />;
      case 'products': return <ProductsPanel lang={lang} isDark={isDark} menuItems={menuItems} categories={categories} fetchMenu={fetchMenu} inventoryStock={inventoryStock} setInventoryStock={setInventoryStock} />;
      case 'categories': return <CategoriesPanel lang={lang} isDark={isDark} categories={categories} fetchCategories={fetchCategories} />;
      case 'orders': return <OrderPanel orders={orders} setOrders={setOrders} viewMode={orderViewMode} selectedDate={orderSelectedDate} onViewModeChange={(mode) => {
        setOrderViewMode(mode);
        if (mode === 'today') setOrderSelectedDate(getDateInputValue(new Date()));
      }} onSelectedDateChange={setOrderSelectedDate} />;
      case 'customers': return <CustomersPanel lang={lang} isDark={isDark} orders={orders} viewMode={customerViewMode} selectedDate={customerSelectedDate} onViewModeChange={(mode) => {
        setCustomerViewMode(mode);
        if (mode === 'today') setCustomerSelectedDate(getDateInputValue(new Date()));
      }} onSelectedDateChange={setCustomerSelectedDate} />;
      case 'inventory': return <InventoryManagementPanel lang={lang} menuItems={menuItems} stock={inventoryStock} setStock={setInventoryStock} drafts={inventoryDrafts} setDrafts={setInventoryDrafts} />;
      case 'coupons': return <CouponsPanel lang={lang} isDark={isDark} />;
      case 'reports': return <OverviewPanel orders={orders} />;
      case 'tables': return <TableQrPanel lang={lang} isDark={isDark} tables={tables} saveTables={saveTables} />;
      case 'accounts': return <AccountsPanelPro accounts={accounts} currentUserId={currentUserId} refreshAccounts={fetchAccounts} />;
    }
  };

  const AdminAuthScreen = () => (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(180deg,#0a0a0b_0%,#111114_100%)] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-zinc-800 bg-zinc-950/95 shadow-[0_32px_120px_rgba(0,0,0,0.45)] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden border-r border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              HCH RESTO ADMIN
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight text-white">
              {pendingTwoFactor ? 'Xác thực 2 lớp' : 'Đăng nhập quản trị'}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-zinc-400">
              {pendingTwoFactor
                ? `Nhập mã OTP đã gửi tới ${pendingTwoFactor?.email ?? ''} để hoàn tất đăng nhập admin.`
                : 'Đăng nhập bằng tài khoản admin để truy cập dashboard, sản phẩm, đơn hàng và các cài đặt bảo mật.'}
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Security</p>
              <p className="mt-2 text-lg font-semibold text-white">Admin account + OTP verification</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Status</p>
              <p className="mt-2 text-sm text-zinc-300">
                {pendingTwoFactor ? 'Waiting for OTP confirmation' : 'Ready for admin sign-in'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8 lg:hidden">
              <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
                HCH RESTO ADMIN
              </span>
              <h1 className="mt-5 text-3xl font-extrabold text-white">{pendingTwoFactor ? 'Xác thực 2 lớp' : 'Đăng nhập Admin'}</h1>
              <p className="mt-2 text-sm text-zinc-400">
                {pendingTwoFactor
                  ? `Nhập mã OTP đã gửi tới ${pendingTwoFactor?.email ?? ''}`
                  : 'Đăng nhập bằng tài khoản admin để vào trang quản trị.'}
              </p>
            </div>

            {pendingTwoFactor?.deliveryWarning && (
              <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {pendingTwoFactor.deliveryWarning}
              </div>
            )}

            {pendingTwoFactor?.devOtp && (
              <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <p className="font-semibold text-white">OTP local de test</p>
                <p className="mt-1 font-mono text-lg tracking-[0.3em]">{pendingTwoFactor.devOtp}</p>
              </div>
            )}

            {pendingTwoFactor ? (
              <form onSubmit={handleOtpVerify} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-200">Mã OTP</label>
                  <input
                    value={loginOtp}
                    onChange={e => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Nhập mã OTP 6 số"
                    className="w-full rounded-2xl border border-zinc-700 bg-black/40 px-4 py-4 text-lg tracking-[0.35em] text-white outline-none transition focus:border-orange-500"
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-4 font-semibold text-white transition hover:bg-orange-400">
                  Xác nhận OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-200">Tên đăng nhập admin</label>
                  <input
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-2xl border border-zinc-700 bg-black/40 px-4 py-4 text-white outline-none transition focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-200">Mật khẩu</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full rounded-2xl border border-zinc-700 bg-black/40 px-4 py-4 text-white outline-none transition focus:border-orange-500"
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-4 font-semibold text-white transition hover:bg-orange-400">
                  Đăng nhập
                </button>
              </form>
            )}

            {authError && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {authError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (authChecking) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Checking admin session...</div>;
  }

  if (!isAuthenticated) {
    return <AdminAuthScreen />;
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
          <h1 className="text-3xl font-extrabold">{pendingTwoFactor ? 'Xác thực 2 lớp' : 'Đăng nhập Admin'}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {pendingTwoFactor
              ? `Nhập mã OTP đã gửi tới ${pendingTwoFactor?.email ?? ''}`
              : 'Đăng nhập bằng tài khoản admin để vào trang quản trị.'}
          </p>

          {pendingTwoFactor ? (
            <form onSubmit={handleOtpVerify} className="mt-6 space-y-4">
              <input
                value={loginOtp}
                onChange={e => setLoginOtp(e.target.value)}
                placeholder="Mã OTP 6 số"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
              <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white">
                Xác nhận OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
              <input
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Tên đăng nhập admin"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3"
              />
              <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white">
                Đăng nhập
              </button>
            </form>
          )}

          {authError && <p className="mt-4 text-sm text-red-400">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900'} min-h-screen flex`}> 
      {/* sidebar */}
      <nav className={`w-56 flex flex-col py-6 px-4 space-y-2 border-r ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'}`}>
        <h2 className="px-3 mb-2 text-xs font-bold uppercase tracking-widest opacity-50">{lang === 'vi' ? 'Danh mục' : 'Categories'}</h2>
        
        {[
          { id: 'dashboard' as Panel, icon: <LayoutDashboard size={20} />, label: t[lang].dashboard },
          { id: 'products' as Panel, icon: <Package size={20} />, label: t[lang].products },
          { id: 'categories' as Panel, icon: <Tags size={20} />, label: t[lang].categories },
          { id: 'orders' as Panel, icon: <ShoppingCart size={20} />, label: t[lang].orders, badge: true },
          { id: 'customers' as Panel, icon: <Users size={20} />, label: t[lang].customers },
          { id: 'tables' as Panel, icon: <QrCode size={20} />, label: lang === 'vi' ? 'QR bàn ăn' : 'Table QR' },
          { id: 'inventory' as Panel, icon: <Boxes size={20} />, label: t[lang].inventory },
          { id: 'coupons' as Panel, icon: <Percent size={20} />, label: t[lang].coupons },
          { id: 'reports' as Panel, icon: <BarChart3 size={20} />, label: t[lang].reports },
          { id: 'accounts' as Panel, icon: <Shield size={20} />, label: t[lang].accounts },
        ].map(item => {
          const isActive = panel === item.id;
          const pendingOrdersCount = orders.filter(o => o.status === (lang === 'vi' ? 'Chờ xử lý' : 'Processing')).length;
          
          return (
            <button
              key={item.id}
              onClick={() => setPanel(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                  : isDark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white' : 'text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {item.icon}
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              {item.badge && pendingOrdersCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingOrdersCount}</span>
              )}
            </button>
          );
        })}
        
        <div className="mt-auto pt-6 flex flex-col gap-2 border-t border-zinc-700">
          <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
            <LogOut size={18} /> <span className="text-sm">{lang === 'vi' ? 'Đăng xuất' : 'Logout'}</span>
          </button>
          <button onClick={()=>setLang(l=> l==='vi'?'en':'vi')} className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>{lang==='vi'?'EN':'VI'}</button>
          <button onClick={()=>setIsDark(d=>!d)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>{isDark?<Sun size={20}/>:<Moon size={20}/>} <span className="text-sm">{isDark ? 'Light' : 'Dark'}</span></button>
        </div>
      </nav>

      {/* main area */}
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-extrabold mb-6">{t[lang].management}</h1>
        {renderContent()}
      </main>
    </div>
  );
}
