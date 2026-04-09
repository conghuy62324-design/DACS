export const buildCustomerMenuPath = (table?: string, floor?: string) => {
  const params = new URLSearchParams();

  if (table) {
    params.set("table", table);
  }

  if (floor) {
    params.set("floor", floor);
  }

  const query = params.toString();
  return query ? `/menu?${query}` : "/menu";
};

export const buildCustomerMenuUrl = (origin: string, table?: string, floor?: string) => {
  const baseOrigin = String(origin || "").replace(/\/+$/, "");
  return `${baseOrigin}${buildCustomerMenuPath(table, floor)}`;
};
