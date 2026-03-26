"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Order {
  id: string;
  table: string;
  floor: string;
  customer: string;
  items: { id: string; qty: number }[];
  total: number;
  status: string;
  handler: string;
  createdAt: string;
}

type InventoryEntry = {
  initial: number;
  sold: number;
  incoming: number;
};

const readDeductedOrderIds = () => {
  try {
    const saved = localStorage.getItem('deductedOrderIds');
    return new Set<string>(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set<string>();
  }
};

const updateInventoryForPaidOrder = (order: Order) => {
  try {
    const deductedOrderIds = readDeductedOrderIds();
    if (deductedOrderIds.has(order.id)) return;

    const raw = localStorage.getItem('inventoryStock');
    const stock: Record<string, InventoryEntry> = raw ? JSON.parse(raw) : {};
    const next = { ...stock };

    order.items.forEach(item => {
      const current = next[item.id] || { initial: 0, sold: 0, incoming: 0 };
      next[item.id] = { ...current, sold: current.sold + item.qty };
    });

    localStorage.setItem('inventoryStock', JSON.stringify(next));
    deductedOrderIds.add(order.id);
    localStorage.setItem('deductedOrderIds', JSON.stringify([...deductedOrderIds]));
  } catch {
    // ignore
  }
};

export default function PayPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      try {
        const res = await fetch('/api/orders');
        const data: Order[] = await res.json();
        const o = data.find(o => o.id === id);
        setOrder(o || null);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrder();
  }, [id]);

  const pay = async () => {
    if (!order) return;
    if (order.status === 'Đã thanh toán') {
      setMsg('Đơn này đã được thanh toán.');
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: 'Đã thanh toán' })
      });
      if (res.ok) {
        setMsg('Thanh toán thành công!');
        setOrder({ ...order, status: 'Đã thanh toán' });
        updateInventoryForPaidOrder(order);

        // update table status to empty
        try {
          const raw = localStorage.getItem('tables');
          if (raw) {
            const tables = JSON.parse(raw) as Array<{ id: string; table: string; floor: string; qr: string; active: boolean; status: string }>;
            const next = tables.map(t => {
              if (t.table === order.table && t.floor === order.floor) {
                return { ...t, status: 'empty' };
              }
              return t;
            });
            localStorage.setItem('tables', JSON.stringify(next));
          }
        } catch {
          // ignore
        }
      } else {
        setMsg('Thanh toán thất bại');
      }
    } catch (err) {
      console.error(err);
      setMsg('Thanh toán thất bại');
    }
  };

  if (!order) return <div className="p-8">Order not found.</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Thanh toán đơn hàng</h1>
      <p>Bàn {order.table} - Tầng {order.floor}</p>
      <p className="mt-2">Tổng: {order.total?.toLocaleString()}đ</p>
      <div className="mt-4 space-y-2">
        {order.items.map(i => (
          <p key={i.id}>- {i.id} × {i.qty}</p>
        ))}
      </div>
      <button onClick={pay} className="mt-6 bg-green-600 text-white px-4 py-2 rounded">
        Thanh toán
      </button>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
