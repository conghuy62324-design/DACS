"use client";

export type InventoryEntry = {
  initial: number;
  sold: number;
  incoming: number;
};

export type PaymentOrderItem = {
  id: string;
  qty: number;
};

export type PaymentOrder = {
  id: string;
  table?: string;
  floor?: string;
  status?: string;
  items: PaymentOrderItem[];
};

export type PaymentMethodType = "banking" | "vietqr" | "ewallet" | "custom";

export type PaymentMethod = {
  id: string;
  name: string;
  type: PaymentMethodType;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  qrImage?: string;
  qrContent?: string;
  paymentLink?: string;
  paymentKey?: string;
  providerName?: string;
  instructions?: string;
  active: boolean;
  updatedAt: string;
};

export const PAYMENT_METHODS_STORAGE_KEY = "paymentMethods";

const normalizeStatus = (value?: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeSeatValue = (value?: string) =>
  String(value || "").trim().replace(/^0+(\d)/, "$1");

export const isPaidOrderStatus = (status?: string) => {
  const normalized = normalizeStatus(status);
  return normalized.includes("paid") || normalized.includes("thanh toan");
};

export const isClosedOrderStatus = (status?: string) => {
  const normalized = normalizeStatus(status);
  return (
    normalized.includes("paid") ||
    normalized.includes("thanh toan") ||
    normalized.includes("tu choi") ||
    normalized.includes("rejected")
  );
};

export const readDeductedOrderIds = () => {
  try {
    const saved = localStorage.getItem("deductedOrderIds");
    return new Set<string>(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set<string>();
  }
};

export const updateInventoryForPaidOrder = (order: PaymentOrder) => {
  try {
    const deductedOrderIds = readDeductedOrderIds();
    if (deductedOrderIds.has(order.id)) return;

    const raw = localStorage.getItem("inventoryStock");
    const stock: Record<string, InventoryEntry> = raw ? JSON.parse(raw) : {};
    const next = { ...stock };

    order.items.forEach(item => {
      const current = next[item.id] || { initial: 0, sold: 0, incoming: 0 };
      next[item.id] = { ...current, sold: current.sold + Number(item.qty || 0) };
    });

    localStorage.setItem("inventoryStock", JSON.stringify(next));
    deductedOrderIds.add(order.id);
    localStorage.setItem("deductedOrderIds", JSON.stringify([...deductedOrderIds]));
  } catch {
    // ignore client storage issues
  }
};

export const updateTableStatusInStorage = (table?: string, floor?: string, status: "empty" | "occupied" | "ordering" = "empty") => {
  if (!table || !floor) return;

  try {
    const raw = localStorage.getItem("tables");
    if (!raw) return;

    const tables = JSON.parse(raw) as Array<{ table: string; floor: string; status: string }>;
    localStorage.setItem(
      "tables",
      JSON.stringify(
        tables.map(item =>
          normalizeSeatValue(item.table) === normalizeSeatValue(table) &&
          normalizeSeatValue(item.floor) === normalizeSeatValue(floor)
            ? { ...item, status }
            : item
        )
      )
    );
  } catch {
    // ignore client storage issues
  }
};

export const readPaymentMethodsFromStorage = () => {
  try {
    const raw = localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PaymentMethod[]) : [];
  } catch {
    return [];
  }
};

export const savePaymentMethodsToStorage = (methods: PaymentMethod[]) => {
  try {
    localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(methods));
  } catch {
    // ignore client storage issues
  }
};
