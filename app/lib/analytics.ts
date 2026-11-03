// Analítica de anulaciones y correcciones: lógica pura (sin React ni Firestore)
// para que el módulo Analítica sea fácil de probar.
//
// Solo los egresos se anulan (ver `prepareMovementVoid`); un ingreso equivocado
// se corrige con "Editar", que deja la versión anterior en `editHistory`. Por eso
// la medición del farmacéutico combina egresos anulados e ingresos corregidos.

import type { Movement } from "./inventory";

/** Período de análisis, contado hacia atrás desde hoy. */
export type AnalyticsPeriod = "30d" | "90d" | "365d" | "all";

export const ANALYTICS_PERIODS: readonly { value: AnalyticsPeriod; label: string }[] = [
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "365d", label: "Últimos 12 meses" },
  { value: "all", label: "Todo el historial" },
];

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, "all">, number> = { "30d": 30, "90d": 90, "365d": 365 };

/** Fecha ISO desde la que cuenta el período (inclusiva), o `null` si es todo el historial. */
export function periodStart(period: AnalyticsPeriod, now: Date = new Date()): string | null {
  if (period === "all") return null;
  return new Date(now.getTime() - PERIOD_DAYS[period] * 86_400_000).toISOString();
}

const inPeriod = (at: string | undefined, since: string | null): at is string =>
  Boolean(at) && (!since || (at as string) >= since);

const normalizeEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();

/** Fila del ranking de medicamentos más anulados. */
export type VoidedMedicineRow = {
  /** `medicineId`, o el nombre si el movimiento no tiene id. */
  key: string;
  medicineId?: string;
  medicineName: string;
  /** Egresos anulados en el período. */
  voids: number;
  /** Unidades reintegradas por esas anulaciones. */
  quantity: number;
  /** Fecha de la anulación más reciente. */
  lastAt: string;
};

/**
 * Medicamentos con más egresos anulados en el período (por fecha de anulación).
 * Orden: más anulaciones, luego más unidades, luego nombre.
 */
export function rankVoidedMedicines(movements: readonly Movement[], since: string | null = null): VoidedMedicineRow[] {
  const rows = new Map<string, VoidedMedicineRow>();
  for (const m of movements) {
    if (m.type !== "OUT" || !inPeriod(m.voidedAt, since)) continue;
    const key = m.medicineId || m.medicineName;
    const row = rows.get(key) ?? { key, medicineId: m.medicineId, medicineName: m.medicineName, voids: 0, quantity: 0, lastAt: m.voidedAt };
    row.voids++;
    row.quantity += Number(m.quantity) || 0;
    if (m.voidedAt > row.lastAt) { row.lastAt = m.voidedAt; row.medicineName = m.medicineName; }
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.voids - a.voids || b.quantity - a.quantity || a.medicineName.localeCompare(b.medicineName));
}

/** Fila del ranking de farmacéuticos por anulaciones y correcciones. */
export type VoidingPharmacistRow = {
  /** Correo (normalizado) de la cuenta que anuló o corrigió. */
  email: string;
  /** Egresos que anuló. */
  voidedOut: number;
  /** Ediciones que hizo sobre ingresos (los ingresos no se anulan, se corrigen). */
  correctedIn: number;
  total: number;
  lastAt: string;
};

/**
 * Quién anula egresos (`voidedByEmail`) y quién corrige ingresos (cada entrada de
 * `editHistory` cuya versión anterior era un ingreso, por `editedByEmail`).
 * Orden: más acciones en total, luego más anulaciones de egresos, luego correo.
 */
export function rankVoidingPharmacists(movements: readonly Movement[], since: string | null = null): VoidingPharmacistRow[] {
  const rows = new Map<string, VoidingPharmacistRow>();
  const bump = (email: string, at: string, field: "voidedOut" | "correctedIn") => {
    const key = normalizeEmail(email) || "(sin correo)";
    const row = rows.get(key) ?? { email: key, voidedOut: 0, correctedIn: 0, total: 0, lastAt: at };
    row[field]++;
    row.total++;
    if (at > row.lastAt) row.lastAt = at;
    rows.set(key, row);
  };
  for (const m of movements) {
    if (m.type === "OUT" && inPeriod(m.voidedAt, since)) bump(m.voidedByEmail ?? "", m.voidedAt, "voidedOut");
    for (const entry of m.editHistory ?? []) {
      if (entry.previous?.type === "IN" && inPeriod(entry.editedAt, since)) bump(entry.editedByEmail, entry.editedAt, "correctedIn");
    }
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || b.voidedOut - a.voidedOut || a.email.localeCompare(b.email));
}

/** Totales del período para las tarjetas de resumen. */
export type VoidTotals = { voidedOut: number; voidedQuantity: number; correctedIn: number; medicines: number; people: number };

export function voidTotals(medicines: readonly VoidedMedicineRow[], people: readonly VoidingPharmacistRow[]): VoidTotals {
  return {
    voidedOut: medicines.reduce((n, r) => n + r.voids, 0),
    voidedQuantity: medicines.reduce((n, r) => n + r.quantity, 0),
    correctedIn: people.reduce((n, r) => n + r.correctedIn, 0),
    medicines: medicines.length,
    people: people.length,
  };
}
