// Lógica de dominio pura del inventario. Sin dependencias de Firebase ni de
// React, para que sea fácil de probar y reutilizar. La UI (app/page.tsx) usa
// estas funciones; los tests viven en app/lib/inventory.test.ts.

export type Medicine = {
  id: string;
  name: string;
  strength: string;
  form: string;
  unit: string;
  stock: number;
  minimumStock: number;
  lot: string;
  expiresAt: string;
  active?: boolean;
};

export type Pharmacist = {
  id: string;
  name: string;
  email: string;
  license: string;
  active?: boolean;
};

export type Movement = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  medicineName: string;
  prescriptionRef: string;
  pharmacistEmail: string;
  createdAt: string;
};

export type MovementType = "IN" | "OUT";

/** Un registro se considera activo salvo que `active` sea explícitamente false. */
export function isActive(item: { active?: boolean }): boolean {
  return item.active !== false;
}

/** Ordena por nombre usando la comparación local (respeta acentos del español). */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/** Solo los medicamentos activos, ordenados por nombre. */
export function activeMedicines(medicines: Medicine[]): Medicine[] {
  return medicines.filter(isActive);
}

/** Filtra por coincidencia (sin distinguir mayúsculas) en nombre + concentración. */
export function filterMedicines(medicines: Medicine[], query: string): Medicine[] {
  const q = query.trim().toLowerCase();
  if (!q) return medicines;
  return medicines.filter((m) =>
    `${m.name} ${m.strength}`.toLowerCase().includes(q)
  );
}

/** Suma total de existencias. */
export function totalStock(medicines: Medicine[]): number {
  return medicines.reduce((acc, m) => acc + (Number(m.stock) || 0), 0);
}

/** Un medicamento está en stock bajo cuando iguala o baja de su mínimo. */
export function isLowStock(medicine: Pick<Medicine, "stock" | "minimumStock">): boolean {
  return medicine.stock <= medicine.minimumStock;
}

/** Cantidad de medicamentos en stock bajo. */
export function lowStockCount(medicines: Medicine[]): number {
  return medicines.filter(isLowStock).length;
}

/**
 * Porcentaje de llenado de la barra de existencias (0–100). Se toma como
 * referencia el doble del stock mínimo; si el mínimo es 0 se usa 1 para evitar
 * dividir entre cero.
 */
export function stockPercent(medicine: Pick<Medicine, "stock" | "minimumStock">): number {
  const reference = Math.max(medicine.minimumStock * 2, 1);
  return Math.min(100, Math.round((medicine.stock / reference) * 100));
}

/** La cantidad de un movimiento debe ser un entero positivo. */
export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

/**
 * Calcula las existencias resultantes tras un movimiento. Lanza un Error si el
 * resultado sería negativo (existencias insuficientes para un egreso).
 */
export function nextStock(
  currentStock: number,
  type: MovementType,
  quantity: number
): number {
  const delta = type === "IN" ? quantity : -quantity;
  const next = (Number(currentStock) || 0) + delta;
  if (next < 0) throw new Error("Existencias insuficientes.");
  return next;
}

/** Datos del medicamento afectado, leídos dentro de la transacción. */
export type MovementMedicine = { name: string; stock: number };

export type MovementInput = {
  medicineId: string;
  type: MovementType;
  quantity: number;
  prescriptionRef: string;
  pharmacistEmail: string;
  createdAt: string;
};

/** El nuevo stock del medicamento y el registro de bitácora a persistir. */
export type PreparedMovement = {
  nextStock: number;
  record: {
    medicineId: string;
    medicineName: string;
    type: MovementType;
    quantity: number;
    prescriptionRef: string;
    pharmacistEmail: string;
    createdAt: string;
  };
};

/**
 * Prepara el registro de un movimiento (ingreso/egreso): valida la cantidad,
 * calcula las existencias resultantes y arma el documento de bitácora. Es pura,
 * no toca Firestore; la transacción real solo persiste lo que devuelve.
 * Lanza un Error con mensaje para el usuario si la cantidad es inválida o las
 * existencias son insuficientes.
 */
export function prepareMovement(
  medicine: MovementMedicine,
  input: MovementInput
): PreparedMovement {
  if (!isValidQuantity(input.quantity)) throw new Error("Cantidad inválida.");
  return {
    nextStock: nextStock(medicine.stock, input.type, input.quantity),
    record: {
      medicineId: input.medicineId,
      medicineName: medicine.name,
      type: input.type,
      quantity: input.quantity,
      prescriptionRef: input.prescriptionRef,
      pharmacistEmail: input.pharmacistEmail,
      createdAt: input.createdAt,
    },
  };
}

// --- Vencimiento -----------------------------------------------------------

/** Días de antelación con que un medicamento se considera "por vencer". */
export const EXPIRY_SOON_DAYS = 30;

/** Estado de vencimiento de un medicamento. */
export type ExpiryStatus = "sin-fecha" | "vencido" | "por-vencer" | "ok";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Interpreta la fecha `YYYY-MM-DD` al mediodía local, igual que la UI. */
function parseExpiry(expiresAt: string): Date | null {
  if (!expiresAt) return null;
  const date = new Date(`${expiresAt}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Mediodía local del día de `date` (para comparar por días de calendario). */
function noonOf(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
}

/**
 * Días de calendario hasta el vencimiento respecto de `now` (negativo si ya
 * venció, 0 si vence hoy). Ignora la hora del día para que el conteo sea
 * estable. Devuelve `null` si no hay fecha o es inválida.
 */
export function daysUntilExpiry(expiresAt: string, now: Date = new Date()): number | null {
  const date = parseExpiry(expiresAt);
  if (!date) return null;
  return Math.round((noonOf(date) - noonOf(now)) / MS_PER_DAY);
}

/**
 * Clasifica el vencimiento: sin fecha, ya vencido, por vencer (dentro de
 * `soonDays`) u ok. El límite `soonDays` es inclusivo.
 */
export function expiryStatus(
  expiresAt: string,
  now: Date = new Date(),
  soonDays: number = EXPIRY_SOON_DAYS
): ExpiryStatus {
  const days = daysUntilExpiry(expiresAt, now);
  if (days === null) return "sin-fecha";
  if (days < 0) return "vencido";
  if (days <= soonDays) return "por-vencer";
  return "ok";
}

/** Medicamentos activos vencidos o por vencer (para alertas del dashboard). */
export function expiringCount(
  medicines: Medicine[],
  now: Date = new Date(),
  soonDays: number = EXPIRY_SOON_DAYS
): number {
  const { expired, soon } = expirySummary(medicines, now, soonDays);
  return expired + soon;
}

/** Conteo de medicamentos activos vencidos y por vencer, por separado. */
export type ExpirySummary = { expired: number; soon: number };

/** Resume cuántos medicamentos activos están vencidos y cuántos por vencer. */
export function expirySummary(
  medicines: Medicine[],
  now: Date = new Date(),
  soonDays: number = EXPIRY_SOON_DAYS
): ExpirySummary {
  const summary: ExpirySummary = { expired: 0, soon: 0 };
  for (const m of activeMedicines(medicines)) {
    const status = expiryStatus(m.expiresAt, now, soonDays);
    if (status === "vencido") summary.expired++;
    else if (status === "por-vencer") summary.soon++;
  }
  return summary;
}
