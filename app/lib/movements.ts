// Filtro y orden de movimientos: lógica pura (sin React ni Firestore) para que
// la vista de Movimientos pueda combinarlos y sea fácil de probar.

import type { Movement, MovementType } from "./inventory";

/** Filtro por tipo: todos, solo ingresos o solo egresos. */
export type MovementTypeFilter = "ALL" | MovementType;

export type MovementFilter = {
  type: MovementTypeFilter;
  /** Texto libre; coincide en medicamento o referencia de prescripción. */
  text: string;
  /** Fecha inicial `YYYY-MM-DD` inclusiva (vacío = sin límite inferior). */
  from?: string;
  /** Fecha final `YYYY-MM-DD` inclusiva (vacío = sin límite superior). */
  to?: string;
};

export type MovementSort = "date-desc" | "date-asc" | "qty-desc" | "qty-asc";

/**
 * Filtra por tipo, texto (sin distinguir mayúsculas) y rango de fechas. El
 * rango compara la fecha (UTC) del movimiento —los primeros 10 caracteres de
 * `createdAt`, en formato ISO `YYYY-MM-DD…`— con los límites, ambos inclusivos.
 */
export function filterMovements(
  movements: readonly Movement[],
  filter: MovementFilter
): Movement[] {
  const q = filter.text.trim().toLowerCase();
  const from = filter.from?.trim() || "";
  const to = filter.to?.trim() || "";
  return movements.filter((m) => {
    if (filter.type !== "ALL" && m.type !== filter.type) return false;
    const day = m.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!q) return true;
    return `${m.medicineName} ${m.prescriptionRef}`.toLowerCase().includes(q);
  });
}

/** Ordena (sin mutar) por fecha o por cantidad, ascendente o descendente. */
export function sortMovements(
  movements: readonly Movement[],
  sort: MovementSort
): Movement[] {
  const copy = [...movements];
  switch (sort) {
    case "date-asc":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "qty-desc":
      return copy.sort((a, b) => b.quantity - a.quantity);
    case "qty-asc":
      return copy.sort((a, b) => a.quantity - b.quantity);
    case "date-desc":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/** Aplica filtro y luego orden. */
export function filterAndSortMovements(
  movements: readonly Movement[],
  filter: MovementFilter,
  sort: MovementSort
): Movement[] {
  return sortMovements(filterMovements(movements, filter), sort);
}
