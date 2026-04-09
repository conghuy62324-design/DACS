"use client";

import React, { useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildCustomerMenuUrl } from '@/lib/qr';

export default function QRManager() {
  const [tablesCount, setTablesCount] = useState(5);
  const [floor, setFloor] = useState(1);
  const [origin] = useState(() => {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  });

  const tables = useMemo(
    () => Array.from({ length: Math.max(1, tablesCount) }, (_, index) => index + 1),
    [tablesCount]
  );

  const makeUrl = (table: number) => {
    return buildCustomerMenuUrl(origin, table.toString().padStart(2, '0'), floor.toString());
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_30%),linear-gradient(180deg,#09090b_0%,#111114_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[32px] border border-zinc-800 bg-zinc-900/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-orange-300">
                QR bàn ăn
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Tạo mã QR theo bàn và tầng</h1>
              <p className="mt-3 text-sm text-zinc-400 sm:text-base">
                Giao diện này đã được tối ưu để xem tốt trên điện thoại, tablet và màn hình lớn khi quản lý QR.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Số bàn</span>
                <input
                  type="number"
                  value={tablesCount}
                  min={1}
                  onChange={(e) => setTablesCount(Number(e.target.value) || 1)}
                  className="mt-3 h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-lg font-semibold text-white outline-none transition focus:border-orange-400"
                />
              </label>
              <label className="rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Tầng</span>
                <input
                  type="number"
                  value={floor}
                  min={1}
                  onChange={(e) => setFloor(Number(e.target.value) || 1)}
                  className="mt-3 h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 text-lg font-semibold text-white outline-none transition focus:border-orange-400"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tables.map((table) => {
            const url = makeUrl(table);
            return (
              <article key={table} className="rounded-[28px] border border-zinc-800 bg-zinc-900/88 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Bàn</p>
                    <h2 className="mt-2 text-3xl font-black">#{table.toString().padStart(2, '0')}</h2>
                  </div>
                  <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                    Tầng {floor}
                  </div>
                </div>

                <div className="mt-5 flex justify-center rounded-[24px] bg-white p-4">
                  <QRCodeCanvas value={url} size={176} includeMargin />
                </div>

                <div className="mt-5 rounded-[22px] border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Liên kết QR</p>
                  <p className="mt-3 break-all text-sm text-zinc-200">{url}</p>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
