// Lógica pura de gestión de lotes (normalización de documentos heredados,
// fusión/validación en ingresos, descuento FEFO/FIFO en egresos y cálculo del
// lote vigente más próximo a vencer). Compartida entre db.ts, demo.ts y adminMutations.ts.

import type { InventoryLot, LotAllocation, MovementType, ReceivedLot } from "./inventory";

/** Obtiene el lote y vencimiento principales a partir de los lotes con saldo positivo (FEFO). */
export function primaryLotSummary(lots: readonly InventoryLot[]): { lot: string; expiresAt: string } {
  const available = [...lots]
    .filter((item) => Number(item.quantity) > 0)
    .sort((a, b) => (a.expiresAt || "9999-12-31").localeCompare(b.expiresAt || "9999-12-31") || (a.receivedAt || "").localeCompare(b.receivedAt || ""));
  return {
    lot: available[0]?.lot || "",
    expiresAt: available[0]?.expiresAt || "",
  };
}

/**
 * Normaliza los lotes de un medicamento. Si el documento proviene del esquema
 * heredado (sin arreglo `lots` pero con `stock > 0`), sintetiza el lote `legacy-<id>`.
 */
export function normalizeMedicineLots(
  data: { stock?: unknown; lot?: unknown; expiresAt?: unknown; lots?: unknown },
  medicineId: string,
  now: string
): InventoryLot[] {
  const stored = Array.isArray(data.lots) ? (data.lots as InventoryLot[]) : [];
  if (stored.length || !(Number(data.stock) > 0)) {
    return stored.map((lot) => ({ ...lot, quantity: Number(lot.quantity) || 0 }));
  }
  return [
    {
      id: `legacy-${medicineId}`,
      lot: String(data.lot || "SIN-LOTE"),
      expiresAt: String(data.expiresAt || ""),
      quantity: Number(data.stock),
      receivedAt: now,
    },
  ];
}

export type LotMovementOptions = {
  type: MovementType;
  quantity: number;
  receivedLots?: readonly ReceivedLot[];
  targetLotId?: string;
  allowExpired?: boolean;
  now: string;
  makeLotId?: (index: number, item: ReceivedLot) => string;
};

/** Indica si un lote está vencido respecto de la fecha ISO (`YYYY-MM-DD...`) de la operación. */
export function isLotExpired(lot: Pick<InventoryLot, "expiresAt">, nowIso: string): boolean {
  const today = nowIso.slice(0, 10);
  return Boolean(lot.expiresAt && today && lot.expiresAt < today);
}

/**
 * Aplica un movimiento (`IN` o `OUT`) sobre la lista de lotes actuales:
 * - En `IN`: valida que haya lotes recibidos, fusiona cantidades si el lote ya
 *   existe con igual fecha de vencimiento (o rechaza si tiene vencimiento contradictorio),
 *   y agrega los lotes nuevos.
 * - En `OUT`: descuenta del lote específico (`targetLotId`) si se indicó, o en orden
 *   FEFO (desempatando por `receivedAt` FIFO), bloqueando lotes vencidos salvo que
 *   `allowExpired` sea verdadero.
 */
export function applyLotMovement(
  lots: readonly InventoryLot[],
  options: LotMovementOptions
): { lots: InventoryLot[]; allocations: LotAllocation[]; lot: string; expiresAt: string } {
  const next = lots.map((lot) => ({ ...lot }));

  if (options.type === "IN") {
    const incoming = options.receivedLots ?? [];
    if (!incoming.length) throw new Error("Registre al menos un lote para el ingreso.");
    if (incoming.reduce((sum, lot) => sum + lot.quantity, 0) !== options.quantity) {
      throw new Error("La cantidad no coincide con los lotes recibidos.");
    }
    const allocations = incoming.map((item, index) => {
      const normalizedCode = item.lot.trim().toLowerCase();
      const existing = next.find((lot) => lot.lot.trim().toLowerCase() === normalizedCode);
      if (existing) {
        if (existing.quantity > 0 && existing.expiresAt && item.expiresAt && existing.expiresAt !== item.expiresAt) {
          throw new Error(`El lote ${item.lot} ya existe con vencimiento ${existing.expiresAt}. Verifique el lote o la fecha.`);
        }
        existing.quantity += item.quantity;
        if (item.expiresAt) existing.expiresAt = item.expiresAt;
        return { lotId: existing.id, lot: existing.lot, expiresAt: existing.expiresAt, quantity: item.quantity };
      }
      const lotId = options.makeLotId ? options.makeLotId(index, item) : `${options.now}-${index}-${item.lot}`;
      next.push({ id: lotId, lot: item.lot, expiresAt: item.expiresAt, quantity: item.quantity, receivedAt: options.now });
      return { lotId, lot: item.lot, expiresAt: item.expiresAt, quantity: item.quantity };
    });
    return { lots: next, allocations, ...primaryLotSummary(next) };
  }

  if (options.targetLotId) {
    const target = next.find((lot) => lot.id === options.targetLotId || lot.lot === options.targetLotId);
    if (!target || target.quantity <= 0) {
      throw new Error("El lote seleccionado no tiene existencias disponibles.");
    }
    if (!options.allowExpired && isLotExpired(target, options.now)) {
      throw new Error("El lote seleccionado está vencido. Active la opción de baja de lote vencido para descargarlo.");
    }
    if (target.quantity < options.quantity) {
      throw new Error("Existencias por lote insuficientes en el lote seleccionado.");
    }
    target.quantity -= options.quantity;
    const allocations: LotAllocation[] = [
      { lotId: target.id, lot: target.lot, expiresAt: target.expiresAt, quantity: options.quantity },
    ];
    return { lots: next, allocations, ...primaryLotSummary(next) };
  }

  let remaining = options.quantity;
  const allocations: LotAllocation[] = [];
  const withStock = next.filter((lot) => lot.quantity > 0);
  const eligible = options.allowExpired
    ? withStock
    : withStock.filter((lot) => !isLotExpired(lot, options.now));
  const ordered = [...eligible].sort(
    (a, b) => (a.expiresAt || "9999-12-31").localeCompare(b.expiresAt || "9999-12-31") || a.receivedAt.localeCompare(b.receivedAt)
  );
  for (const lot of ordered) {
    if (!remaining) break;
    const used = Math.min(lot.quantity, remaining);
    lot.quantity -= used;
    remaining -= used;
    allocations.push({ lotId: lot.id, lot: lot.lot, expiresAt: lot.expiresAt, quantity: used });
  }
  if (remaining) {
    const expiredAvailable = !options.allowExpired && withStock.some((lot) => isLotExpired(lot, options.now));
    if (expiredAvailable) {
      throw new Error("Existencias vigentes insuficientes: hay lotes vencidos bloqueados. Active la opción de baja de lote vencido si corresponde.");
    }
    throw new Error("Existencias por lote insuficientes.");
  }
  return { lots: next, allocations, ...primaryLotSummary(next) };
}

/** Calcula una previsualización sin efectos secundarios de los lotes que se descontarán en un egreso. */
export function previewLotOut(
  lots: readonly InventoryLot[],
  options: { quantity: number; now: string; targetLotId?: string; allowExpired?: boolean }
): { allocations: LotAllocation[]; error?: string } {
  if (!Number.isInteger(options.quantity) || options.quantity <= 0) {
    return { allocations: [] };
  }
  try {
    const res = applyLotMovement(lots, {
      type: "OUT",
      quantity: options.quantity,
      targetLotId: options.targetLotId,
      allowExpired: options.allowExpired,
      now: options.now,
    });
    return { allocations: res.allocations };
  } catch (err) {
    return { allocations: [], error: err instanceof Error ? err.message : "No se puede descontar la cantidad indicada." };
  }
}

