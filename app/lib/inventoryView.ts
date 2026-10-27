import { daysUntilExpiry, expiryStatus, isLowStock, type InventoryLot, type Medicine } from "./inventory";

export type InventoryFilter = "all" | "low" | "expired" | "soon" | "unknown" | "no-stock" | "normal";
export type InventorySort = "name" | "stock" | "expiry";
export type InventorySummary = { total: number; low: number; expired: number; soon: number; unknown: number };

/** Proyección de lectura. No completa ni escribe documentos heredados. */
export function inventoryLotView(medicine: Medicine) {
  const stored = medicine.lots ?? [];
  const legacy = stored.length === 0 && medicine.stock > 0;
  const lots: InventoryLot[] = legacy ? [{
    id: `legacy-${medicine.id}`, lot: medicine.lot || "", expiresAt: medicine.expiresAt || "",
    quantity: medicine.stock, receivedAt: "",
  }] : stored;
  const positive = lots.filter((lot) => lot.quantity > 0);
  const dates = positive.map((lot) => lot.expiresAt).filter((date) => daysUntilExpiry(date) !== null).sort();
  return {
    lots, positive, legacy, nearest: dates[0] || "",
    expired: positive.some((lot) => expiryStatus(lot.expiresAt) === "vencido"),
    soon: positive.some((lot) => expiryStatus(lot.expiresAt) === "por-vencer"),
    unknown: positive.some((lot) => expiryStatus(lot.expiresAt) === "sin-fecha"),
    mismatch: stored.length > 0 && stored.reduce((sum, lot) => sum + lot.quantity, 0) !== medicine.stock,
  };
}

export function matchesInventoryFilter(medicine: Medicine, filter: InventoryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "low") return isLowStock(medicine);
  if (filter === "no-stock") return medicine.stock === 0;
  const view = inventoryLotView(medicine);
  if (filter === "unknown") return view.unknown || view.mismatch;
  if (filter === "expired") return view.expired;
  if (filter === "soon") return view.soon;
  return medicine.stock > 0 && !isLowStock(medicine) && !view.expired && !view.soon && !view.unknown && !view.mismatch;
}

export function summarizeInventory(medicines: readonly Medicine[]): InventorySummary {
  return medicines.reduce((summary, medicine) => {
    const view = inventoryLotView(medicine);
    summary.total++;
    if (isLowStock(medicine)) summary.low++;
    if (view.expired) summary.expired++;
    if (view.soon) summary.soon++;
    if (view.unknown || view.mismatch) summary.unknown++;
    return summary;
  }, { total: 0, low: 0, expired: 0, soon: 0, unknown: 0 });
}

const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Incluye identificadores de todos los lotes, también los agotados, para trazabilidad. */
export function selectInventory(medicines: readonly Medicine[], query: string, filter: InventoryFilter, sort: InventorySort): Medicine[] {
  const text = normalized(query);
  return medicines.filter((medicine) => {
    const searchable = [medicine.name, medicine.strength, medicine.form, medicine.code || "", medicine.lot, ...(medicine.lots ?? []).map((lot) => lot.lot)].join(" ");
    return normalized(searchable).includes(text) && matchesInventoryFilter(medicine, filter);
  }).sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "es") || a.strength.localeCompare(b.strength, "es") || a.id.localeCompare(b.id);
    if (sort === "stock") return a.stock - b.stock || byName;
    if (sort === "expiry") return (inventoryLotView(a).nearest || "9999").localeCompare(inventoryLotView(b).nearest || "9999") || byName;
    return byName;
  });
}

export function inventoryDateLabel(date: string): string {
  return daysUntilExpiry(date) === null ? "Fecha no registrada" : new Date(`${date}T12:00:00`).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
}
