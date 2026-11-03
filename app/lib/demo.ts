import { prepareMovement, type InventoryLot, type Medicine, type Movement, type Pharmacist, type ReceivedLot } from "./inventory";
import { appendEditHistory } from "./movements";
import { applyLotMovement, normalizeMedicineLots, prepareMovementEdit, prepareMovementVoid, primaryLotSummary, type MovementEditRequest, type MovementVoidRequest } from "./lots";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
export const DEMO_EMAIL = "demo@consulta-externa.local";

type DemoState = { medicines: Medicine[]; pharmacists: Pharmacist[]; movements: Movement[] };

const isoDate = (daysFromToday: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
};

const isoTime = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600000).toISOString();

const initialState: DemoState = {
  medicines: [
    { id: "demo-metformina", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades", stock: 320, minimumStock: 80, lot: "MF-26014", expiresAt: isoDate(240), code: "101-20-5001", active: true },
    { id: "demo-insulina", name: "Insulina glargina", strength: "100 UI/mL", form: "Solución inyectable", unit: "unidades", stock: 12, minimumStock: 20, lot: "IG-1182", expiresAt: isoDate(120), code: "102-14-0202", active: true },
    { id: "demo-clonazepam", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "unidades", stock: 96, minimumStock: 30, lot: "DEMO-CZ-VENCIDO", expiresAt: isoDate(-5), code: "103-02-0403", active: true, lastCountAt: isoTime(22), lastCountBy: "maria.gomez@demo.local", lots: [
      { id: "demo-cz-1", lot: "DEMO-CZ-VENCIDO", expiresAt: isoDate(-5), quantity: 6, receivedAt: isoTime(500) },
      { id: "demo-cz-2", lot: "DEMO-CZ-PROXIMO", expiresAt: isoDate(20), quantity: 30, receivedAt: isoTime(400) },
      { id: "demo-cz-3", lot: "DEMO-CZ-VIGENTE", expiresAt: isoDate(198), quantity: 60, receivedAt: isoTime(300) },
    ] },
    { id: "demo-morfina", name: "Morfina", strength: "10 mg/mL", form: "Solución inyectable", unit: "ampollas", stock: 8, minimumStock: 15, lot: "MF-7805", expiresAt: isoDate(9), code: "104-10-7805", active: true },
    { id: "demo-levotiroxina", name: "Levotiroxina", strength: "100 mcg", form: "Tableta", unit: "unidades", stock: 184, minimumStock: 50, lot: "LV-3348", expiresAt: isoDate(290), code: "105-10-3338", active: true },
    { id: "demo-salbutamol", name: "Salbutamol", strength: "100 mcg/dosis", form: "Inhalador", unit: "unidades", stock: 42, minimumStock: 20, lot: "SB-9087", expiresAt: isoDate(-3), code: "106-10-9087", active: true },
  ],
  pharmacists: [
    { id: "demo-ph-1", name: "María Gómez", email: "maria.gomez@demo.local", license: "CF-2841", active: true },
    { id: "demo-ph-2", name: "Carlos Rodríguez", email: "carlos.rodriguez@demo.local", license: "CF-3156", active: true },
  ],
  movements: [
    { id: "demo-mov-1", medicineId: "demo-metformina", medicineName: "Metformina", type: "OUT", quantity: 30, prescriptionRef: "RX-DEMO-00481", pharmacistEmail: "maria.gomez@demo.local", createdAt: isoTime(1) },
    { id: "demo-mov-2", medicineId: "demo-insulina", medicineName: "Insulina glargina", type: "IN", quantity: 10, prescriptionRef: "Ingreso de proveedor", pharmacistEmail: "carlos.rodriguez@demo.local", createdAt: isoTime(3) },
    // Ejemplos para Analítica: un egreso anulado (no afecta existencias) y un ingreso corregido.
    { id: "demo-mov-4", medicineId: "demo-morfina", medicineName: "Morfina", type: "OUT", quantity: 2, prescriptionRef: "RX-DEMO-00476", pharmacistEmail: "carlos.rodriguez@demo.local", createdAt: isoTime(30), voidedAt: isoTime(29), voidedByEmail: "maria.gomez@demo.local", voidReason: "Egreso duplicado por error de digitación" },
    { id: "demo-mov-5", medicineId: "demo-levotiroxina", medicineName: "Levotiroxina", type: "IN", quantity: 100, prescriptionRef: "Ingreso de proveedor", pharmacistEmail: "carlos.rodriguez@demo.local", createdAt: isoTime(52), updatedAt: isoTime(50), updatedByEmail: "carlos.rodriguez@demo.local", editHistory: [{ editedAt: isoTime(50), editedByEmail: "carlos.rodriguez@demo.local", previous: { type: "IN", quantity: 1000, medicineId: "demo-levotiroxina", medicineName: "Levotiroxina", prescriptionRef: "Ingreso de proveedor", pharmacistEmail: "carlos.rodriguez@demo.local" } }] },
    { id: "demo-mov-3", medicineId: "demo-clonazepam", medicineName: "Clonazepam", type: "COUNT", quantity: 96, systemQuantity: 96, difference: 0, note: "Saldo confirmado", prescriptionRef: "", pharmacistEmail: "maria.gomez@demo.local", createdAt: isoTime(22) },
  ],
};

let state: DemoState = structuredClone(initialState);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const subscribeDemo = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getDemoSnapshot = () => state;
export const resetDemoStore = () => { state = structuredClone(initialState); emit(); };
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function demoUpdateMedicine(medicineId: string, fields: Partial<Medicine>) {
  state = {
    ...state,
    medicines: state.medicines.map((m) => {
      if (m.id !== medicineId) return m;
      const lotSummary = m.lots?.length ? primaryLotSummary(m.lots) : {};
      return { ...m, ...fields, ...lotSummary };
    }),
  };
  emit();
}

export function demoCreateMedicine(fields: Omit<Medicine, "id" | "unit" | "stock">, stock: number, pharmacistEmail = "") {
  const newId = id("demo-med");
  const now = new Date().toISOString();
  const initialLot: InventoryLot | null = stock > 0 ? { id: `initial-${newId}`, lot: fields.lot, expiresAt: fields.expiresAt, quantity: stock, receivedAt: now } : null;
  const created: Medicine = { ...fields, id: newId, unit: "unidades", stock, lots: initialLot ? [initialLot] : [] };
  const initialMovements: Movement[] = initialLot
    ? [{ id: id("demo-mov"), medicineId: newId, medicineName: fields.name, type: "IN", quantity: stock, prescriptionRef: "Existencia inicial", pharmacistEmail, createdAt: now, lotAllocations: [{ lotId: initialLot.id, lot: initialLot.lot, expiresAt: initialLot.expiresAt, quantity: stock }] }]
    : [];
  state = { ...state, medicines: [...state.medicines, created], movements: [...initialMovements, ...state.movements] };
  emit();
}

export function demoCreatePharmacist(fields: Omit<Pharmacist, "id">) {
  state = { ...state, pharmacists: [...state.pharmacists, { ...fields, id: id("demo-ph") }] }; emit();
}

export function demoUpdatePharmacist(pharmacistId: string, fields: Partial<Pharmacist>) {
  state = { ...state, pharmacists: state.pharmacists.map((p) => p.id === pharmacistId ? { ...p, ...fields } : p) }; emit();
}

export function demoSetActive(collection: "medicines" | "pharmacists", itemId: string, active: boolean) {
  state = collection === "medicines"
    ? { ...state, medicines: state.medicines.map((m) => m.id === itemId ? { ...m, active } : m) }
    : { ...state, pharmacists: state.pharmacists.map((p) => p.id === itemId ? { ...p, active } : p) };
  emit();
}

export function demoRegisterMovement(
  input: Omit<Movement, "id" | "medicineName">,
  receivedLots?: ReceivedLot[],
  outOptions?: { targetLotId?: string; allowExpired?: boolean }
) {
  const medicine = state.medicines.find((m) => m.id === input.medicineId);
  if (!medicine) throw new Error("Medicamento no disponible.");
  if (input.type !== "IN" && input.type !== "OUT") throw new Error("Tipo de movimiento inválido.");
  const prepared = prepareMovement(medicine, { medicineId: medicine.id, type: input.type, quantity: input.quantity, prescriptionRef: input.prescriptionRef, note: input.note, pharmacistEmail: input.pharmacistEmail, createdAt: input.createdAt });
  const lotResult = applyLotMovement(normalizeMedicineLots(medicine, medicine.id, input.createdAt), {
    type: input.type,
    quantity: input.quantity,
    receivedLots,
    targetLotId: outOptions?.targetLotId,
    allowExpired: outOptions?.allowExpired,
    now: input.createdAt,
    makeLotId: () => id("demo-lot"),
  });
  const record: Movement = { ...input, lotAllocations: lotResult.allocations, id: id("demo-mov"), medicineName: medicine.name };
  state = {
    medicines: state.medicines.map((m) => m.id === medicine.id ? { ...m, stock: prepared.nextStock, lots: lotResult.lots, lot: lotResult.lot, expiresAt: lotResult.expiresAt } : m),
    pharmacists: state.pharmacists,
    movements: [record, ...state.movements],
  };
  emit();
}

export function demoUpdateMovement(req: MovementEditRequest) {
  const original = state.movements.find((m) => m.id === req.movementId);
  if (!original) throw new Error("Movimiento no disponible.");
  const originalMedicine = state.medicines.find(
    (m) => m.id === (original.medicineId || req.medicineId) || m.name === original.medicineName
  );
  if (!originalMedicine) throw new Error("El medicamento original del movimiento ya no existe.");
  const targetMedicine = state.medicines.find((m) => m.id === req.medicineId);
  if (!targetMedicine) throw new Error("Medicamento no disponible.");

  const plan = prepareMovementEdit({
    original,
    originalMedicine,
    targetMedicine,
    input: { ...req, makeLotId: () => id("demo-lot") },
  });

  state = {
    ...state,
    medicines: state.medicines.map((m) => {
      if (plan.previousMedicineUpdate && m.id === originalMedicine.id) {
        return { ...m, ...plan.previousMedicineUpdate };
      }
      if (m.id === targetMedicine.id) {
        return { ...m, ...plan.targetMedicineUpdate };
      }
      return m;
    }),
    movements: state.movements.map((m) =>
      m.id === original.id
        ? { ...plan.movementRecord, id: original.id, updatedAt: req.now, updatedByEmail: DEMO_EMAIL, editHistory: appendEditHistory(original, req.now, DEMO_EMAIL) }
        : m
    ),
  };
  emit();
}

export function demoVoidMovement(req: MovementVoidRequest) {
  const original = state.movements.find((m) => m.id === req.movementId);
  if (!original) throw new Error("Movimiento no disponible.");
  const medicine = state.medicines.find((m) => m.id === original.medicineId);
  if (!medicine) throw new Error("El medicamento del egreso ya no existe.");
  const plan = prepareMovementVoid({ original, medicine, reason: req.reason, now: req.now });
  state = {
    ...state,
    medicines: state.medicines.map((m) => (m.id === medicine.id ? { ...m, ...plan.medicineUpdate } : m)),
    movements: state.movements.map((m) =>
      m.id === original.id ? { ...m, ...plan.voidFields, voidedByEmail: DEMO_EMAIL } : m
    ),
  };
  emit();
}

export function demoRegisterCount(record: Omit<Movement, "id">) {
  state = {
    ...state,
    medicines: state.medicines.map((m) =>
      m.id === record.medicineId
        ? { ...m, lastCountAt: record.createdAt, lastCountBy: record.pharmacistEmail }
        : m
    ),
    movements: [{ ...record, id: id("demo-count") }, ...state.movements],
  };
  emit();
}

export function demoClearDatabase() {
  state = { medicines: [], pharmacists: [], movements: [] };
  emit();
}

export function demoExportDatabase(): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: DEMO_EMAIL,
    collections: {
      medicines: state.medicines,
      pharmacists: state.pharmacists,
      authorizedOperators: state.pharmacists
        .filter((p) => p.active !== false)
        .map((p) => ({ id: p.email, email: p.email, pharmacistId: p.id, active: true })),
      movements: state.movements,
      auditLogs: [],
      operationalEvents: [],
    },
  };
}
