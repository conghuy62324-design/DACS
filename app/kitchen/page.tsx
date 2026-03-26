"use client";

import React, { useEffect, useMemo, useState } from 'react';

interface OrderItem {
  id: string;
  qty: number;
}

interface Order {
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

interface MenuItem {
  id: string;
  nameVi: string;
  nameEn: string;
  price: number;
}

type KitchenTab = 'queue' | 'history';

const STATUS = {
  pending: 'Chờ xử lý',
  cooking: 'Đang nấu',
  cooked: 'Đã nấu xong',
  served: 'Đã phục vụ',
  paid: 'Đã thanh toán',
  rejected: 'Từ chối',
} as const;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function normalizeStatus(status: string) {
  const normalized = normalizeText(status);

  if (normalized.includes('paid') || normalized.includes('thanh toan')) return STATUS.paid;
  if (normalized.includes('phuc vu')) return STATUS.served;
  if (normalized.includes('nau xong') || normalized.includes('cooked')) return STATUS.cooked;
  if (normalized.includes('dang nau') || normalized.includes('cooking')) return STATUS.cooking;
  if (normalized.includes('tu choi') || normalized.includes('rejected')) return STATUS.rejected;
  if (normalized.includes('processing') || normalized.includes('cho xu ly')) return STATUS.pending;

  return status || STATUS.pending;
}

function isSameDay(dateString: string, now: Date) {
  const date = new Date(dateString);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default function KitchenView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState<KitchenTab>('queue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, menuRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/menu'),
        ]);

        const ordersData: Order[] = await ordersRes.json();
        const menuData: MenuItem[] = await menuRes.json();

        setMenu(Array.isArray(menuData) ? menuData : []);
        setOrders(
          (Array.isArray(ordersData) ? ordersData : []).map(order => ({
            ...order,
            status: normalizeStatus(order.status),
          }))
        );
      } catch (err) {
        console.error('Failed to fetch kitchen data', err);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const getMinutesPassed = (createdAt: string) => {
    const orderTime = new Date(createdAt);
    return Math.max(0, Math.floor((now.getTime() - orderTime.getTime()) / 60000));
  };

  const getMenuName = (itemId: string) => {
    const item = menu.find(menuItem => menuItem.id === itemId);
    return item ? item.nameVi : itemId;
  };

  const queueOrders = useMemo(() => {
    return [...orders]
      .filter(order => {
        const status = normalizeStatus(order.status);
        return status === STATUS.pending || status === STATUS.cooking;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders]);

  const todayHistoryOrders = useMemo(() => {
    return [...orders]
      .filter(order => isSameDay(order.createdAt, now))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, now]);

  const queueStats = useMemo(() => {
    const pending = queueOrders.filter(order => normalizeStatus(order.status) === STATUS.pending).length;
    const cooking = queueOrders.filter(order => normalizeStatus(order.status) === STATUS.cooking).length;
    const totalItems = queueOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0),
      0
    );

    return { pending, cooking, totalItems };
  }, [queueOrders]);

  const printOrder = (order: Order) => {
    const itemsText = order.items.map(item => `${getMenuName(item.id)} x ${item.qty}`).join('\n');
    const win = window.open('', '_blank');
    if (!win) return;

    const html = `
      <html>
        <head>
          <style>
            body { font-family: monospace; padding: 20px; }
            .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
            .items { margin: 20px 0; white-space: pre-wrap; }
            .footer { text-align: center; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">DON HANG #${order.id}</div>
          <div>Ban: ${order.table || 'N/A'} (Tang ${order.floor || 'N/A'})</div>
          <div>Khach: ${order.customer || 'N/A'}</div>
          <div class="items">${itemsText}</div>
          <div class="footer">Tong: ${formatCurrency(order.total || 0)}</div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    win.print();
  };

  const updateOrderStatus = async (order: Order, status: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order');
      }

      setOrders(prev =>
        prev.map(current => (current.id === order.id ? { ...current, status } : current))
      );

      setSelectedOrder(prev => (prev?.id === order.id ? { ...prev, status } : prev));
    } catch (err) {
      console.error('Failed to update order status', err);
    }
  };

  const markCooking = async (order: Order) => updateOrderStatus(order, STATUS.cooking);

  const markCooked = async (order: Order) => {
    await updateOrderStatus(order, STATUS.cooked);
    setTimeout(() => printOrder(order), 300);
  };

  const renderOrderLines = (order: Order) => {
    if (order.items.length === 0) {
      return <p className="text-sm text-zinc-500">Chưa có chi tiết món.</p>;
    }

    return (
      <div className="grid gap-2 md:grid-cols-2">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl bg-zinc-900/80 px-3 py-3">
            <span className="text-sm font-medium text-zinc-100">{getMenuName(item.id)}</span>
            <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">
              x{item.qty}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(180deg,#0f172a_0%,#111827_45%,#09090b_100%)] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Kitchen Control
            </p>
            <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">Giao diện bếp</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              Theo dõi hàng đợi nấu theo thứ tự vào trước trước, vẫn giữ số bàn và tầng từ QR khách hàng, đồng thời xem lại toàn bộ đơn trong ngày.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Chờ xử lý</p>
              <p className="mt-2 text-3xl font-black text-cyan-300">{queueStats.pending}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Đang nấu</p>
              <p className="mt-2 text-3xl font-black text-amber-300">{queueStats.cooking}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Thời gian</p>
              <p className="mt-2 text-2xl font-black text-white">{now.toLocaleTimeString('vi-VN')}</p>
              <p className="mt-1 text-xs text-zinc-500">{now.toLocaleDateString('vi-VN')}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setTab('queue')}
                className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                  tab === 'queue'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                Hàng đợi bếp
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={`rounded-2xl px-5 py-3 text-sm font-bold transition ${
                  tab === 'history'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                Đơn trong ngày
              </button>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              {tab === 'queue'
                ? 'Đơn vào sớm nhất sẽ hiện đầu tiên. Mỗi thẻ hiển thị thứ tự xử lý và giữ nguyên thông tin bàn từ QR.'
                : 'Lịch sử hôm nay hiển thị theo thứ tự thời gian tạo, giúp xem lại luồng đơn đã vào bếp trong ngày.'}
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tổng quan nhanh</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-zinc-950/80 p-4">
                <p className="text-xs text-zinc-500">Đơn đang chờ</p>
                <p className="mt-2 text-2xl font-black text-white">{queueOrders.length}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950/80 p-4">
                <p className="text-xs text-zinc-500">Tổng món đang xử lý</p>
                <p className="mt-2 text-2xl font-black text-white">{queueStats.totalItems}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950/80 p-4">
                <p className="text-xs text-zinc-500">Đơn hôm nay</p>
                <p className="mt-2 text-2xl font-black text-white">{todayHistoryOrders.length}</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-16 text-center text-zinc-400">
            Đang tải dữ liệu bếp...
          </div>
        ) : tab === 'queue' ? (
          queueOrders.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] px-6 py-20 text-center">
              <p className="text-3xl font-black text-white">Không có đơn chờ xử lý</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {queueOrders.map((order, index) => {
                const minutesPassed = getMinutesPassed(order.createdAt);
                const isUrgent = minutesPassed >= 15;
                const status = normalizeStatus(order.status);
                const previewItems = order.items.slice(0, 3);
                const remainingItems = order.items.length - previewItems.length;

                return (
                  <div
                    key={order.id}
                    className={`rounded-[1.8rem] border p-4 shadow-2xl transition ${
                      isUrgent
                        ? 'border-red-500/40 bg-red-500/10 shadow-red-950/30'
                        : status === STATUS.cooking
                          ? 'border-amber-500/30 bg-amber-500/10 shadow-amber-950/20'
                          : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-zinc-950/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                            Thứ tự #{index + 1}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            status === STATUS.cooking ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/15 text-cyan-300'
                          }`}>
                            {status === STATUS.cooking ? 'Đang nấu' : 'Chờ xử lý'}
                          </span>
                          {isUrgent && (
                            <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-bold text-red-300">
                              Trễ {minutesPassed} phút
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-black text-white">Đơn #{order.id}</h2>
                        <p className="mt-2 text-sm text-zinc-300">
                          {order.table ? `Bàn ${order.table}` : 'Chưa có bàn'}
                          {order.floor ? ` • Tầng ${order.floor}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {order.customer || 'Khách lẻ'} • {new Date(order.createdAt).toLocaleTimeString('vi-VN')}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-zinc-950/80 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Đang chờ</p>
                        <p className="mt-1 text-2xl font-black text-white">{minutesPassed}&apos;</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-zinc-950/60 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Phiếu món</p>
                        <p className="text-sm font-bold text-orange-400">{formatCurrency(order.total)}</p>
                      </div>
                      <div className="space-y-2">
                        {previewItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                            <span className="truncate pr-3 text-sm text-zinc-100">{getMenuName(item.id)}</span>
                            <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-300">
                              x{item.qty}
                            </span>
                          </div>
                        ))}
                        {remainingItems > 0 && (
                          <p className="px-1 text-xs text-zinc-500">+{remainingItems} món nữa</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
                      >
                        Xem
                      </button>
                      {status === STATUS.pending && (
                        <button
                          type="button"
                          onClick={() => markCooking(order)}
                          className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
                        >
                          Nấu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => markCooked(order)}
                        className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-500"
                      >
                        Xong
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
            <div className="mb-5 grid grid-cols-[110px_120px_100px_1fr_130px_130px] gap-3 border-b border-white/10 px-3 pb-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              <div>Thứ tự</div>
              <div>Bàn</div>
              <div>Giờ vào</div>
              <div>Món</div>
              <div>Trạng thái</div>
              <div>Thao tác</div>
            </div>

            <div className="space-y-3">
              {todayHistoryOrders.length === 0 ? (
                <div className="px-3 py-12 text-center text-zinc-500">Hôm nay chưa có đơn hàng nào.</div>
              ) : (
                todayHistoryOrders.map((order, index) => {
                  const status = normalizeStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-[110px_120px_100px_1fr_130px_130px] gap-3 rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-4 text-sm"
                    >
                      <div>
                        <p className="font-black text-white">#{index + 1}</p>
                        <p className="mt-1 text-xs text-zinc-500">{order.id}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{order.table ? `Bàn ${order.table}` : '--'}</p>
                        <p className="mt-1 text-xs text-zinc-500">{order.floor ? `Tầng ${order.floor}` : 'Không có tầng'}</p>
                      </div>
                      <div className="font-medium text-zinc-300">
                        {new Date(order.createdAt).toLocaleTimeString('vi-VN')}
                      </div>
                      <div>
                        <p className="font-medium text-white">{order.customer || 'Khách lẻ'}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {order.items.map(item => `${getMenuName(item.id)} x${item.qty}`).join(', ') || 'Không có món'}
                        </p>
                      </div>
                      <div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          status === STATUS.pending
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : status === STATUS.cooking
                              ? 'bg-amber-500/15 text-amber-300'
                              : status === STATUS.cooked
                                ? 'bg-green-500/15 text-green-300'
                                : status === STATUS.paid
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-zinc-700 text-zinc-200'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
                        >
                          Xem lại
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Chi tiết đơn</p>
                <h2 className="mt-2 text-3xl font-black text-white">Đơn #{selectedOrder.id}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Bàn {selectedOrder.table || '--'} • Tầng {selectedOrder.floor || '--'} • {selectedOrder.customer || 'Khách lẻ'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-2xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Đóng
              </button>
            </div>

            <div className="mb-6 grid gap-4 xl:grid-cols-[320px_1fr]">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Bàn QR</p>
                  <p className="mt-2 text-xl font-black text-white">{selectedOrder.table ? `Bàn ${selectedOrder.table}` : '--'}</p>
                  <p className="mt-1 text-sm text-zinc-400">{selectedOrder.floor ? `Tầng ${selectedOrder.floor}` : 'Không có tầng'}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Thời gian vào đơn</p>
                  <p className="mt-2 text-xl font-black text-white">{new Date(selectedOrder.createdAt).toLocaleTimeString('vi-VN')}</p>
                  <p className="mt-1 text-sm text-zinc-400">{new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tổng tiền</p>
                  <p className="mt-2 text-xl font-black text-orange-400">{formatCurrency(selectedOrder.total)}</p>
                  <p className="mt-1 text-sm text-zinc-400">{normalizeStatus(selectedOrder.status)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tổng số món</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {selectedOrder.items.reduce((sum, item) => sum + item.qty, 0)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{selectedOrder.items.length} dòng món</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-300">Danh sách món</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Hiển thị toàn bộ để quét nhanh
                  </p>
                </div>
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  {renderOrderLines(selectedOrder)}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => printOrder(selectedOrder)}
                className="rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-yellow-400"
              >
                In đơn
              </button>
              <button
                type="button"
                onClick={() => markCooking(selectedOrder)}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
              >
                Chuyển sang đang nấu
              </button>
              <button
                type="button"
                onClick={() => markCooked(selectedOrder)}
                className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-500"
              >
                Hoàn tất món
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
