// Filtro y orden de movimientos: lógica pura (sin React ni Firestore) para que
// la vista de Movimientos pueda combinarlos y sea fácil de probar.

import type { Movement, MovementType } from "./inventory";

/** Filtro por tipo: todos, solo ingresos o solo egresos. */
export type MovementTypeFilter = "ALL" | MovementType;

export type MovementFilter = {
  type: MovementTypeFilter;
  /** Texto libre; coincide en medicamento o referencia de prescripción. */
  text: string;
};

export type MovementSort = "date-desc" | "date-asc" | "qty-desc" | "qty-asc";

/** Filtra por tipo y por coincidencia de texto (sin distinguir mayúsculas). */
export function filterMovements(
  movements: readonly Movement[],
  filter: MovementFilter
): Movement[] {
  const q = filter.text.trim().toLowerCase();
  return movements.filter((m) => {
    if (filter.type !== "ALL" && m.type !== filter.type) return false;
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
