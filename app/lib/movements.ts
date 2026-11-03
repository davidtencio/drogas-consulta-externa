// Filtro y orden de movimientos: lógica pura (sin React ni Firestore) para que
// la vista de Movimientos pueda combinarlos y sea fácil de probar.

import type { Movement, MovementEditEntry, MovementSnapshot } from "./inventory";

/** Filtro por tipo: todos, ingresos, egresos o conteos. */
export type MovementTypeFilter = "ALL" | "IN" | "OUT" | "COUNT";

export type MovementFilter = {
  type: MovementTypeFilter;
  /** Texto libre; coincide en medicamento, lote, referencia de prescripción o nota. */
  text: string;
  /** Filtra a un medicamento concreto por su id (vacío = todos). */
  medicineId?: string;
  /** Filtra por correo del farmacéutico responsable (vacío = todos). */
  pharmacistEmail?: string;
  /** Fecha inicial `YYYY-MM-DD` inclusiva (vacío = sin límite inferior). */
  from?: string;
  /** Fecha final `YYYY-MM-DD` inclusiva (vacío = sin límite superior). */
  to?: string;
};

export type MovementSort = "date-desc" | "date-asc" | "qty-desc" | "qty-asc";

/**
 * Filtra por tipo, medicamento, farmacéutico, texto (sin distinguir mayúsculas,
 * incluyendo códigos de lote en `lotAllocations`) y rango de fechas. El rango
 * compara la fecha (UTC) del movimiento —los primeros 10 caracteres de
 * `createdAt`, ISO `YYYY-MM-DD…`— con los límites, inclusivos.
 */
export function filterMovements(
  movements: readonly Movement[],
  filter: MovementFilter
): Movement[] {
  const q = filter.text.trim().toLowerCase();
  const medicineId = filter.medicineId?.trim() || "";
  const pharmacistEmail = filter.pharmacistEmail?.trim().toLowerCase() || "";
  const from = filter.from?.trim() || "";
  const to = filter.to?.trim() || "";
  return movements.filter((m) => {
    if (filter.type !== "ALL" && m.type !== filter.type) return false;
    if (medicineId && m.medicineId !== medicineId) return false;
    if (pharmacistEmail && m.pharmacistEmail.trim().toLowerCase() !== pharmacistEmail) return false;
    const day = m.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (!q) return true;
    const lotsText = m.lotAllocations?.map((lot) => lot.lot).join(" ") ?? "";
    return `${m.medicineName} ${m.prescriptionRef} ${m.note ?? ""} ${lotsText}`.toLowerCase().includes(q);
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

/**
 * Fecha (ISO) del último conteo/arqueo por medicamento: `medicineId` → createdAt
 * más reciente entre los movimientos de tipo "COUNT". Ignora movimientos sin id.
 */
export function lastCountByMedicine(movements: readonly Movement[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of movements) {
    if (m.type !== "COUNT" || !m.medicineId) continue;
    const prev = map.get(m.medicineId);
    if (!prev || m.createdAt > prev) map.set(m.medicineId, m.createdAt);
  }
  return map;
}

/** Último registro completo de toma de inventario por medicamento. */
export function lastCountMovementByMedicine(movements: readonly Movement[]): Map<string, Movement> {
  const map = new Map<string, Movement>();
  for (const movement of movements) {
    if (movement.type !== "COUNT" || !movement.medicineId) continue;
    const previous = map.get(movement.medicineId);
    if (!previous || movement.createdAt > previous.createdAt) map.set(movement.medicineId, movement);
  }
  return map;
}

/** Resumen agregado de un conjunto de movimientos (p. ej. un período filtrado). */
export type MovementSummary = {
  /** Total de eventos (ingresos, egresos y conteos). */
  count: number;
  /** Número de ingresos y de egresos. */
  inCount: number;
  outCount: number;
  /** Número de conteos físicos (arqueos). */
  countEvents: number;
  /** Unidades sumadas por ingresos y por egresos. */
  inQuantity: number;
  outQuantity: number;
  /** Variación neta de existencias (ingresos − egresos). Los conteos no afectan. */
  net: number;
  /** Medicamentos distintos con movimientos. */
  medicineCount: number;
  /** Egresos anulados: se listan por trazabilidad pero no suman a las cantidades. */
  voidedCount: number;
};

/**
 * Agrega conteos y cantidades de una lista de movimientos. Los conteos físicos
 * (type "COUNT") no afectan las sumas de flujo (ingresos/egresos/neto); solo se
 * cuentan aparte. Los movimientos anulados solo suman a `count` y `voidedCount`.
 * Ignora cantidades no numéricas (las trata como 0).
 */
export function summarizeMovements(movements: readonly Movement[]): MovementSummary {
  const summary: MovementSummary = {
    count: 0,
    inCount: 0,
    outCount: 0,
    countEvents: 0,
    inQuantity: 0,
    outQuantity: 0,
    net: 0,
    medicineCount: 0,
    voidedCount: 0,
  };
  const names = new Set<string>();
  for (const m of movements) {
    const qty = Number(m.quantity) || 0;
    summary.count++;
    if (m.voidedAt) {
      summary.voidedCount++;
      continue;
    }
    names.add(m.medicineName);
    if (m.type === "IN") {
      summary.inCount++;
      summary.inQuantity += qty;
    } else if (m.type === "OUT") {
      summary.outCount++;
      summary.outQuantity += qty;
    } else {
      summary.countEvents++;
    }
  }
  summary.net = summary.inQuantity - summary.outQuantity;
  summary.medicineCount = names.size;
  return summary;
}

/**
 * Copia los datos vigentes del movimiento (sin campos indefinidos, que Firestore
 * no admite) para guardarlos como versión anterior antes de editarlo.
 */
export function movementSnapshot(movement: Movement): MovementSnapshot {
  return {
    type: movement.type,
    quantity: movement.quantity,
    medicineName: movement.medicineName,
    prescriptionRef: movement.prescriptionRef ?? "",
    pharmacistEmail: movement.pharmacistEmail ?? "",
    ...(movement.medicineId ? { medicineId: movement.medicineId } : {}),
    ...(movement.note ? { note: movement.note } : {}),
    ...(movement.lotAllocations?.length ? { lotAllocations: movement.lotAllocations } : {}),
  };
}

/** Historial con la versión actual agregada al final; nunca reescribe entradas previas. */
export function appendEditHistory(original: Movement, editedAt: string, editedByEmail: string): MovementEditEntry[] {
  return [...(original.editHistory ?? []), { editedAt, editedByEmail, previous: movementSnapshot(original) }];
}

/**
 * Fecha de la última toma de inventario posterior al movimiento, o `null` si el
 * movimiento es posterior (o no hay toma). Corregir un movimiento anterior a una
 * toma puede duplicar un ajuste que ya compensó la diferencia encontrada.
 */
export function countAfterMovement(movement: Pick<Movement, "createdAt">, lastCountAt?: string | null): string | null {
  if (!lastCountAt || !movement.createdAt) return null;
  return movement.createdAt < lastCountAt ? lastCountAt : null;
}
