// Lógica pura de gestión de lotes (normalización de documentos heredados,
// fusión/validación en ingresos, descuento FEFO/FIFO en egresos y cálculo del
// lote vigente más próximo a vencer). Compartida entre db.ts, demo.ts y adminMutations.ts.

import {
  isValidQuantity,
  prepareMovement,
  type InventoryLot,
  type LotAllocation,
  type Medicine,
  type Movement,
  type MovementType,
  type PreparedMovement,
  type ReceivedLot,
} from "./inventory";

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
  revertedLotIds?: readonly string[];
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
  const revertedSet = new Set(options.revertedLotIds ?? []);

  if (options.type === "IN") {
    const incoming = options.receivedLots ?? [];
    if (!incoming.length) throw new Error("Registre al menos un lote para el ingreso.");
    if (incoming.reduce((sum, lot) => sum + lot.quantity, 0) !== options.quantity) {
      throw new Error("La cantidad no coincide con los lotes recibidos.");
    }
    const allocations = incoming.map((item, index) => {
      const normalizedCode = item.lot.trim().toLowerCase();
      let existing = next.find((lot) => lot.lot.trim().toLowerCase() === normalizedCode);
      if (!existing && options.revertedLotIds?.[index]) {
        const candidate = next.find((lot) => lot.id === options.revertedLotIds![index]);
        const codeClaimedElsewhere = incoming.some(
          (other, otherIdx) => otherIdx !== index && other.lot.trim().toLowerCase() === candidate?.lot.trim().toLowerCase()
        );
        if (candidate && candidate.quantity <= 0 && !codeClaimedElsewhere) {
          existing = candidate;
          existing.lot = item.lot.trim();
        }
      }
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
    const negativeLot = next.find((lot) => lot.quantity < 0);
    if (negativeLot) {
      throw new Error(`No se puede modificar el ingreso: el lote ${negativeLot.lot} quedaría con saldo negativo porque ya tuvo egresos.`);
    }
    const cleaned = revertedSet.size
      ? next.filter((lot) => !(revertedSet.has(lot.id) && lot.quantity === 0))
      : next;
    return { lots: cleaned, allocations, ...primaryLotSummary(cleaned) };
  }

  const preNegativeLot = next.find((lot) => lot.quantity < 0);
  if (preNegativeLot) {
    throw new Error(`No se puede revertir el ingreso del lote ${preNegativeLot.lot} porque parte de sus existencias ya fue descargada.`);
  }
  const workingLots = revertedSet.size
    ? next.filter((lot) => !(revertedSet.has(lot.id) && lot.quantity === 0))
    : next;

  if (options.targetLotId) {
    const target = workingLots.find((lot) => lot.id === options.targetLotId || lot.lot === options.targetLotId);
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
    return { lots: workingLots, allocations, ...primaryLotSummary(workingLots) };
  }

  let remaining = options.quantity;
  const allocations: LotAllocation[] = [];
  const withStock = workingLots.filter((lot) => lot.quantity > 0);
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
  return { lots: workingLots, allocations, ...primaryLotSummary(workingLots) };
}

export type RevertedLotResult = {
  lots: InventoryLot[];
  revertedLotIds: string[];
  lot: string;
  expiresAt: string;
};

/**
 * Deshace el efecto de un movimiento previo (`IN` u `OUT`) sobre la lista de lotes:
 * - Si el movimiento original fue `OUT`, reintegra las cantidades descontadas a sus lotes.
 * - Si el movimiento original fue `IN`, resta las cantidades ingresadas de sus lotes.
 */
export function revertLotMovement(
  lots: readonly InventoryLot[],
  original: Pick<Movement, "type" | "quantity" | "lotAllocations" | "createdAt">,
  fallbackMedicine?: { id?: string; lot?: string; expiresAt?: string },
  now: string = new Date().toISOString()
): RevertedLotResult {
  const next = lots.map((lot) => ({ ...lot }));
  const revertedLotIds: string[] = [];

  if (original.type === "OUT") {
    if (original.lotAllocations && original.lotAllocations.length > 0) {
      for (const alloc of original.lotAllocations) {
        const normalizedCode = alloc.lot.trim().toLowerCase();
        const existing =
          next.find((lot) => lot.id === alloc.lotId) ??
          next.find((lot) => lot.lot.trim().toLowerCase() === normalizedCode);
        if (existing) {
          existing.quantity += alloc.quantity;
          if (!existing.expiresAt && alloc.expiresAt) existing.expiresAt = alloc.expiresAt;
        } else {
          next.push({
            id: alloc.lotId || `${original.createdAt || now}-restored-${alloc.lot}`,
            lot: alloc.lot,
            expiresAt: alloc.expiresAt,
            quantity: alloc.quantity,
            receivedAt: original.createdAt || now,
          });
        }
      }
    } else {
      const fallbackCode = (fallbackMedicine?.lot || "").trim().toLowerCase();
      const existing =
        (fallbackCode ? next.find((lot) => lot.lot.trim().toLowerCase() === fallbackCode) : undefined) ?? next[0];
      if (existing) {
        existing.quantity += original.quantity;
      } else {
        next.push({
          id: `legacy-${fallbackMedicine?.id || "med"}`,
          lot: String(fallbackMedicine?.lot || "SIN-LOTE"),
          expiresAt: String(fallbackMedicine?.expiresAt || ""),
          quantity: original.quantity,
          receivedAt: original.createdAt || now,
        });
      }
    }
  } else if (original.type === "IN") {
    if (original.lotAllocations && original.lotAllocations.length > 0) {
      for (const alloc of original.lotAllocations) {
        const normalizedCode = alloc.lot.trim().toLowerCase();
        const existing =
          next.find((lot) => lot.id === alloc.lotId) ??
          next.find((lot) => lot.lot.trim().toLowerCase() === normalizedCode);
        if (existing) {
          existing.quantity -= alloc.quantity;
          revertedLotIds.push(existing.id);
        } else {
          const missingId = alloc.lotId || `${original.createdAt || now}-missing-${alloc.lot}`;
          next.push({
            id: missingId,
            lot: alloc.lot,
            expiresAt: alloc.expiresAt,
            quantity: -alloc.quantity,
            receivedAt: original.createdAt || now,
          });
          revertedLotIds.push(missingId);
        }
      }
    } else {
      const fallbackCode = (fallbackMedicine?.lot || "").trim().toLowerCase();
      const preferred =
        (fallbackCode ? next.find((lot) => lot.lot.trim().toLowerCase() === fallbackCode) : undefined) ?? next[0];
      if (preferred) {
        preferred.quantity -= original.quantity;
        revertedLotIds.push(preferred.id);
      } else {
        const missingId = `legacy-${fallbackMedicine?.id || "med"}`;
        next.push({
          id: missingId,
          lot: String(fallbackMedicine?.lot || "SIN-LOTE"),
          expiresAt: String(fallbackMedicine?.expiresAt || ""),
          quantity: -original.quantity,
          receivedAt: original.createdAt || now,
        });
        revertedLotIds.push(missingId);
      }
    }
  }

  return { lots: next, revertedLotIds, ...primaryLotSummary(next) };
}

/**
 * Devuelve una proyección del medicamento con el movimiento en edición revertido,
 * para previsualizar correctamente el saldo y los lotes disponibles en el diálogo.
 */
export function effectiveMedicineForMovementEdit(
  medicine: Medicine,
  editingMovement?: Movement | null,
  nowIso: string = new Date().toISOString()
): Medicine {
  if (!editingMovement || editingMovement.medicineId !== medicine.id || (editingMovement.type !== "IN" && editingMovement.type !== "OUT")) {
    return medicine;
  }
  const delta = editingMovement.type === "OUT" ? editingMovement.quantity : -editingMovement.quantity;
  const revertedStock = Math.max(0, (Number(medicine.stock) || 0) + delta);
  const reverted = revertLotMovement(normalizeMedicineLots(medicine, medicine.id, nowIso), editingMovement, medicine, nowIso);
  const cleanedLots = reverted.lots
    .filter((lot) => !(reverted.revertedLotIds.includes(lot.id) && lot.quantity <= 0))
    .map((lot) => ({ ...lot, quantity: Math.max(0, lot.quantity) }));
  return {
    ...medicine,
    stock: revertedStock,
    lots: cleanedLots,
    lot: reverted.lot,
    expiresAt: reverted.expiresAt,
  };
}

export type MovementEditRequest = {
  movementId: string;
  medicineId: string;
  type: MovementType;
  quantity: number;
  prescriptionRef: string;
  note?: string;
  receivedLots?: readonly ReceivedLot[];
  targetLotId?: string;
  allowExpired?: boolean;
  pharmacistEmail: string;
  now: string;
  makeLotId?: (index: number, item: ReceivedLot) => string;
};

export type MedicineStockUpdate = {
  stock: number;
  lots: InventoryLot[];
  lot: string;
  expiresAt: string;
};

export type PreparedMovementEdit = {
  previousMedicineUpdate?: MedicineStockUpdate;
  targetMedicineUpdate: MedicineStockUpdate;
  movementRecord: PreparedMovement["record"];
};

/**
 * Calcula de forma pura la edición de un movimiento (`IN` u `OUT`):
 * revierte el impacto original en lotes y existencias (sobre el mismo medicamento
 * o sobre el medicamento anterior si se cambió) y aplica el nuevo movimiento.
 */
export function prepareMovementEdit(params: {
  original: Movement;
  originalMedicine: Pick<Medicine, "id" | "name" | "stock" | "lot" | "expiresAt" | "lots">;
  targetMedicine: Pick<Medicine, "id" | "name" | "stock" | "lot" | "expiresAt" | "lots">;
  input: MovementEditRequest;
}): PreparedMovementEdit {
  const { original, originalMedicine, targetMedicine, input } = params;
  if (original.type !== "IN" && original.type !== "OUT") {
    throw new Error("Solo se pueden editar ingresos y egresos.");
  }
  if (original.voidedAt) {
    throw new Error("El movimiento está anulado y no puede editarse.");
  }
  if (!isValidQuantity(input.quantity)) {
    throw new Error("Cantidad inválida.");
  }

  const origStock = Number(originalMedicine.stock) || 0;
  const origQty = Number(original.quantity) || 0;
  const revertedStock = origStock + (original.type === "OUT" ? origQty : -origQty);
  const origNormalized = normalizeMedicineLots(originalMedicine, originalMedicine.id, input.now);
  const reverted = revertLotMovement(origNormalized, original, originalMedicine, input.now);
  const effectiveNow = original.createdAt || input.now;

  if (originalMedicine.id === targetMedicine.id) {
    const lotResult = applyLotMovement(reverted.lots, {
      type: input.type,
      quantity: input.quantity,
      receivedLots: input.receivedLots,
      targetLotId: input.targetLotId,
      allowExpired: input.allowExpired,
      revertedLotIds: reverted.revertedLotIds,
      now: effectiveNow,
      makeLotId: input.makeLotId,
    });
    const { nextStock, record } = prepareMovement(
      { name: targetMedicine.name, stock: revertedStock },
      {
        medicineId: targetMedicine.id,
        type: input.type,
        quantity: input.quantity,
        prescriptionRef: input.prescriptionRef,
        note: input.note,
        lotAllocations: lotResult.allocations,
        pharmacistEmail: input.pharmacistEmail,
        createdAt: effectiveNow,
      }
    );
    return {
      targetMedicineUpdate: {
        stock: nextStock,
        lots: lotResult.lots,
        lot: lotResult.lot,
        expiresAt: lotResult.expiresAt,
      },
      movementRecord: record,
    };
  }

  const negativeLot = reverted.lots.find((lot) => lot.quantity < 0);
  if (negativeLot || revertedStock < 0) {
    throw new Error(
      negativeLot
        ? `No se puede cambiar el medicamento: el lote ${negativeLot.lot} del ingreso original ya tuvo egresos.`
        : "No se puede cambiar el medicamento porque parte de las existencias del ingreso original ya fue descargada."
    );
  }
  const cleanedPrevLots = reverted.lots.filter(
    (lot) => !(reverted.revertedLotIds.includes(lot.id) && lot.quantity === 0)
  );
  const prevSummary = primaryLotSummary(cleanedPrevLots);
  const previousMedicineUpdate: MedicineStockUpdate = {
    stock: revertedStock,
    lots: cleanedPrevLots,
    lot: prevSummary.lot,
    expiresAt: prevSummary.expiresAt,
  };

  const targetNormalized = normalizeMedicineLots(targetMedicine, targetMedicine.id, input.now);
  const targetLotResult = applyLotMovement(targetNormalized, {
    type: input.type,
    quantity: input.quantity,
    receivedLots: input.receivedLots,
    targetLotId: input.targetLotId,
    allowExpired: input.allowExpired,
    now: effectiveNow,
    makeLotId: input.makeLotId,
  });
  const { nextStock, record } = prepareMovement(
    { name: targetMedicine.name, stock: Number(targetMedicine.stock) || 0 },
    {
      medicineId: targetMedicine.id,
      type: input.type,
      quantity: input.quantity,
      prescriptionRef: input.prescriptionRef,
      note: input.note,
      lotAllocations: targetLotResult.allocations,
      pharmacistEmail: input.pharmacistEmail,
      createdAt: effectiveNow,
    }
  );
  return {
    previousMedicineUpdate,
    targetMedicineUpdate: {
      stock: nextStock,
      lots: targetLotResult.lots,
      lot: targetLotResult.lot,
      expiresAt: targetLotResult.expiresAt,
    },
    movementRecord: record,
  };
}

export const VOID_REASON_MIN_LENGTH = 10;

export type MovementVoidRequest = {
  movementId: string;
  reason: string;
  now: string;
};

export type PreparedMovementVoid = {
  medicineUpdate: MedicineStockUpdate;
  voidFields: { voidedAt: string; voidReason: string };
};

/**
 * Prepara la anulación de un egreso que no correspondía: reintegra la cantidad a
 * las existencias y a los mismos lotes de los que se descontó. El movimiento no se
 * borra; se marca como anulado con fecha y motivo para conservar la trazabilidad.
 */
export function prepareMovementVoid(params: {
  original: Movement;
  medicine: Pick<Medicine, "id" | "name" | "stock" | "lot" | "expiresAt" | "lots">;
  reason: string;
  now: string;
}): PreparedMovementVoid {
  const { original, medicine, now } = params;
  const reason = params.reason.trim();
  if (original.type !== "OUT") throw new Error("Solo se pueden anular egresos.");
  if (original.voidedAt) throw new Error("El egreso ya fue anulado.");
  if (reason.length < VOID_REASON_MIN_LENGTH) {
    throw new Error(`Indique el motivo de la anulación (mínimo ${VOID_REASON_MIN_LENGTH} caracteres).`);
  }
  const quantity = Number(original.quantity) || 0;
  const normalized = normalizeMedicineLots(medicine, medicine.id, now);
  const reverted = revertLotMovement(normalized, original, medicine, now);
  return {
    medicineUpdate: {
      stock: (Number(medicine.stock) || 0) + quantity,
      lots: reverted.lots,
      lot: reverted.lot,
      expiresAt: reverted.expiresAt,
    },
    voidFields: { voidedAt: now, voidReason: reason },
  };
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

