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
