"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
import {
  isPaidOrderStatus,
  readPaymentMethodsFromStorage,
  updateInventoryForPaidOrder,
  updateTableStatusInStorage,
  type PaymentMethod,
} from '@/lib/payment-client';

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
}

const PAID_STATUS = 'Đã thanh toán';

const formatCurrency = (value: number) => value.toLocaleString('vi-VN');

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const getPaymentTypeLabel = (value: PaymentMethod['type']) => {
  switch (value) {
    case 'banking':
      return 'Chuyển khoản';
    case 'vietqr':
      return 'VietQR';
    case 'ewallet':
      return 'Ví điện tử';
    default:
      return 'Khác';
  }
};

export default function PayPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [msg, setMsg] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const [ordersRes, menuRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/menu'),
        ]);
        const ordersData: Order[] = await ordersRes.json();
        const menuData: MenuItem[] = await menuRes.json();
        setOrder((Array.isArray(ordersData) ? ordersData : []).find(item => item.id === id) || null);
        setMenu(Array.isArray(menuData) ? menuData : []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    const syncPaymentMethods = () => {
      setPaymentMethods(readPaymentMethodsFromStorage().filter(method => method.active));
    };

    syncPaymentMethods();
    window.addEventListener('storage', syncPaymentMethods);
    const interval = window.setInterval(syncPaymentMethods, 1500);

    return () => {
      window.removeEventListener('storage', syncPaymentMethods);
      window.clearInterval(interval);
    };
  }, []);

  const orderLines = useMemo(() => {
    if (!order) return [];
    return order.items.map(item => ({
      ...item,
      name: menu.find(menuItem => menuItem.id === item.id)?.nameVi || item.id,
    }));
  }, [menu, order]);

  const pay = async () => {
    if (!order || isPaying) return;

    if (isPaidOrderStatus(order.status)) {
      setMsg('Đơn này đã được thanh toán.');
      return;
    }

    setIsPaying(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: PAID_STATUS }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order');
      }

      setOrder({ ...order, status: PAID_STATUS });
      setMsg('Thanh toán thành công.');
      updateInventoryForPaidOrder(order);
      updateTableStatusInStorage(order.table, order.floor, 'empty');
    } catch (err) {
      console.error(err);
      setMsg('Thanh toán thất bại.');
    } finally {
      setIsPaying(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-6 text-center sm:p-10">
          <h1 className="text-2xl font-bold sm:text-3xl">Không tìm thấy đơn hàng</h1>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">Đơn có thể đã bị xóa hoặc mã thanh toán không còn hợp lệ.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.24),_transparent_35%),linear-gradient(180deg,#09090b_0%,#111114_100%)] px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 lg:gap-6">
        <section className="rounded-[30px] border border-orange-500/20 bg-zinc-900/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-orange-300">
                Thanh toán đơn hàng
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Đơn #{order.id}</h1>
                <p className="mt-2 text-sm text-zinc-300 sm:text-base">
                  Bàn {order.table || '--'} • Tầng {order.floor || '--'} • {formatTime(order.createdAt)}
                </p>
              </div>
            </div>
            <div className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${isPaidOrderStatus(order.status) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {order.status || 'Chờ xử lý'}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Khách hàng</p>
              <p className="mt-3 text-lg font-bold text-white">{order.customer || 'Khách lẻ'}</p>
            </div>
            <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Nhân viên</p>
              <p className="mt-3 text-lg font-bold text-white">{order.handler || 'Chưa gán'}</p>
            </div>
            <div className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Tổng món</p>
              <p className="mt-3 text-lg font-bold text-white">
                {order.items.reduce((sum, item) => sum + item.qty, 0)} món
              </p>
            </div>
            <div className="rounded-[24px] border border-orange-500/25 bg-orange-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-orange-200/70">Tổng tiền</p>
              <p className="mt-3 text-2xl font-black text-orange-300 sm:text-3xl">{formatCurrency(order.total || 0)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-zinc-800 bg-zinc-900/88 p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Danh sách món</h2>
              <p className="mt-1 text-sm text-zinc-400">Hiển thị đầy đủ món trong đơn để đối soát trước khi thanh toán.</p>
            </div>
            <p className="text-sm font-semibold text-zinc-300">{orderLines.length} dòng món</p>
          </div>

          <div className="mt-5 grid gap-3">
            {orderLines.map(item => (
              <div key={item.id} className="flex flex-col gap-3 rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold text-white">{item.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">Mã món: {item.id}</p>
                </div>
                <div className="inline-flex w-fit rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200">
                  Số lượng: {item.qty}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Cần thu</p>
              <p className="mt-2 text-3xl font-black text-orange-300">{formatCurrency(order.total || 0)}</p>
            </div>
            <button
              onClick={pay}
              disabled={isPaying || isPaidOrderStatus(order.status)}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-500 px-6 text-base font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300 sm:min-w-[220px]"
            >
              {isPaidOrderStatus(order.status) ? 'Đã thanh toán' : isPaying ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </button>
          </div>

          {msg && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${msg.includes('thành công') || msg.includes('đã được') ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {msg}
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-zinc-800 bg-zinc-900/88 p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Cổng thanh toán</h2>
              <p className="mt-1 text-sm text-zinc-400">Quét QR hoặc dùng thông tin chuyển khoản bên dưới để thanh toán đơn hàng này.</p>
            </div>
            <p className="text-sm font-semibold text-zinc-300">{paymentMethods.length} lựa chọn</p>
          </div>

          {paymentMethods.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {paymentMethods.map(method => (
                <div key={method.id} className="rounded-[26px] border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-black text-white">{method.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-orange-300">{getPaymentTypeLabel(method.type)}</p>
                    </div>
                    <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Sẵn sàng
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
                    <div className="flex justify-center">
                      {method.qrImage ? (
                        <Image src={method.qrImage} alt={method.name} width={180} height={180} unoptimized className="h-[180px] w-[180px] rounded-3xl bg-white object-cover p-2" />
                      ) : method.qrContent ? (
                        <div className="rounded-3xl bg-white p-3">
                          <QRCodeCanvas value={method.qrContent} size={156} includeMargin />
                        </div>
                      ) : (
                        <div className="flex h-[180px] w-[180px] items-center justify-center rounded-3xl border border-dashed border-zinc-700 text-center text-sm text-zinc-500">
                          Chưa có QR
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {method.providerName && (
                        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Cổng / nhà cung cấp</p>
                          <p className="mt-2 text-sm font-bold text-white">{method.providerName}</p>
                        </div>
                      )}
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Ngân hàng / ví</p>
                        <p className="mt-2 text-sm font-bold text-white">{method.bankName || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Số tài khoản / ID</p>
                        <p className="mt-2 break-all text-sm font-bold text-white">{method.accountNumber || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Chủ tài khoản</p>
                        <p className="mt-2 text-sm font-bold text-white">{method.accountName || '--'}</p>
                      </div>
                      {method.paymentKey && (
                        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Key / mã định danh</p>
                          <p className="mt-2 break-all text-sm font-bold text-white">{method.paymentKey}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {method.paymentLink && (
                    <div className="mt-4">
                      <a
                        href={method.paymentLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500"
                      >
                        Mở cổng thanh toán
                      </a>
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-orange-200/80">Nội dung chuyển khoản gợi ý</p>
                    <p className="mt-2 text-sm font-bold text-white">HCH {order.id}</p>
                    <p className="mt-2 text-sm text-orange-100/80">
                      {method.instructions || 'Vui lòng ghi đúng mã đơn hàng trong nội dung chuyển khoản để nhà hàng đối soát nhanh hơn.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[26px] border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center text-sm text-zinc-400">
              Chưa có cổng thanh toán nào được cấu hình ở trang admin.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
