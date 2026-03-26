"use client";
import React, { useEffect, useState } from 'react';

interface OrderItem { id: string; qty: number; }
interface Order { id: string; table: string; floor: string; customer: string; items: OrderItem[]; total: number; status: string; handler: string; createdAt: string; }
interface MenuItem { id: string; nameVi: string; nameEn: string; price: number; }

export default function KitchenView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes, menuRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/menu')
        ]);
        const ordersData: Order[] = await ordersRes.json();
        const menuData: MenuItem[] = await menuRes.json();
        
        setMenu(menuData);
        // Filter to show only unfinished orders, sorted by createdAt
        const pendingOrders = ordersData
          .filter(o => o.status !== 'Đã nấu xong' && o.status !== 'Đã thanh toán')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setOrders(pendingOrders);
      } catch (err) {
        console.error('Failed to fetch data', err);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const getMinutesPassed = (createdAt: string) => {
    const orderTime = new Date(createdAt);
    const minutes = Math.floor((now.getTime() - orderTime.getTime()) / 60000);
    return minutes;
  };

  const isVeryLate = (createdAt: string) => {
    return getMinutesPassed(createdAt) >= 15;
  };

  const getMenuName = (itemId: string) => {
    const item = menu.find(m => m.id === itemId);
    return item ? item.nameVi : itemId;
  };

  const printOrder = (order: Order) => {
    const itemsText = order.items.map(i => `${getMenuName(i.id)} × ${i.qty}`).join('\n');
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
          <div class="header">ĐƠN HÀNG #${order.id}</div>
          <div>Bàn: ${order.table || 'N/A'} (Tầng ${order.floor || 'N/A'})</div>
          <div>Khách: ${order.customer || 'N/A'}</div>
          <div class="items">${itemsText}</div>
          <div class="footer">Tổng: ${order.total?.toLocaleString() || 0}đ</div>
        </body>
      </html>
    `;
    
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const markCooked = async (order: Order) => {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: 'Đã nấu xong' })
      });
      setOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedOrder(null);
      // Print immediately after marking done
      setTimeout(() => printOrder(order), 500);
    } catch (err) {
      console.error('Failed to update order status', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">🍳 Giao diện Bếp</h1>
          <div className="text-lg">Thời gian: {now.toLocaleTimeString('vi-VN')}</div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl text-gray-400">✓ Không có đơn hàng chờ xử lý</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const minutesPassed = getMinutesPassed(order.createdAt);
              const isLate = isVeryLate(order.createdAt);
              
              return (
                <div
                  key={order.id}
                  className={`rounded-lg p-6 border-2 transition-all ${
                    isLate
                      ? 'bg-red-900/30 border-red-500 shadow-lg shadow-red-500/50'
                      : 'bg-gray-800 border-gray-700 hover:border-blue-500'
                  }`}
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-bold mb-2">Đơn #{order.id}</h2>
                    
                    {order.table && (
                      <p className="text-sm text-gray-300">
                        📍 Bàn {order.table} • Tầng {order.floor}
                      </p>
                    )}
                    
                    {order.customer && (
                      <p className="text-sm text-gray-300">
                        👤 {order.customer}
                      </p>
                    )}
                    
                    <p className={`text-sm font-semibold mt-2 ${isLate ? 'text-red-300' : 'text-blue-300'}`}>
                      ⏱️ {minutesPassed} phút
                      {isLate && ' ⚠️ CHẬM'}
                    </p>
                  </div>

                  <div className="bg-gray-700/50 rounded p-3 mb-4">
                    <p className="text-xs text-gray-400 mb-2">Các món:</p>
                    <div className="space-y-1">
                      {order.items.map((item) => (
                        <p key={item.id} className="text-sm">
                          • {getMenuName(item.id)} × <span className="font-bold">{item.qty}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold transition"
                    >
                      👁️ Xem
                    </button>
                    <button
                      onClick={() => markCooked(order)}
                      className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold transition"
                    >
                      ✓ Xong
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Xem Chi Tiết */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Chi tiết đơn hàng</h2>
            
            <div className="mb-6 space-y-2">
              <p className="text-gray-300"><strong>Mã đơn:</strong> {selectedOrder.id}</p>
              {selectedOrder.table && (
                <p className="text-gray-300"><strong>Bàn:</strong> {selectedOrder.table} (Tầng {selectedOrder.floor})</p>
              )}
              {selectedOrder.customer && (
                <p className="text-gray-300"><strong>Khách:</strong> {selectedOrder.customer}</p>
              )}
              <p className="text-gray-300"><strong>Thời gian:</strong> {new Date(selectedOrder.createdAt).toLocaleTimeString('vi-VN')}</p>
            </div>

            <div className="bg-gray-700/50 rounded p-4 mb-6">
              <h3 className="font-semibold mb-3">Danh sách món</h3>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-gray-600 pb-2">
                    <span>{getMenuName(item.id)}</span>
                    <span className="font-bold bg-blue-600 px-3 py-1 rounded">×{item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="text-right mt-4 pt-4 border-t border-gray-600">
                <p className="text-lg font-bold">Tổng: {selectedOrder.total?.toLocaleString()}đ</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-semibold transition"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  printOrder(selectedOrder);
                  setSelectedOrder(null);
                }}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded font-semibold transition"
              >
                🖨️ In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
