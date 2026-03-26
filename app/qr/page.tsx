"use client";
import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QRManager() {
  const [tablesCount, setTablesCount] = useState(5);
  const [floor, setFloor] = useState(1);
  const [origin] = useState(() => {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  });

  const makeUrl = (table: number) => {
    const params = new URLSearchParams();
    params.set('table', table.toString().padStart(2, '0'));
    params.set('floor', floor.toString());
    return `${origin}/?${params.toString()}`;
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Quản lý mã QR</h1>
      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-sm font-semibold">Số bàn</label>
          <input
            type="number"
            value={tablesCount}
            min={1}
            onChange={(e) => setTablesCount(Number(e.target.value))}
            className="border p-1 w-20 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold">Tầng</label>
          <input
            type="number"
            value={floor}
            min={1}
            onChange={(e) => setFloor(Number(e.target.value))}
            className="border p-1 w-20 rounded"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Array.from({ length: tablesCount }, (_, i) => i + 1).map((t) => {
          const url = makeUrl(t);
          return (
            <div key={t} className="flex flex-col items-center">
              <QRCodeCanvas value={url} size={128} />
              <p className="mt-2 text-sm">Bàn {t}, tầng {floor}</p>
              <p className="text-xs break-all w-32 text-center">{url}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
