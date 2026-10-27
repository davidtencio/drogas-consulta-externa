import { prepareMovement, type InventoryLot, type LotAllocation, type Medicine, type Movement, type Pharmacist, type ReceivedLot } from "./inventory";

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
    { id: "demo-clonazepam", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "unidades", stock: 96, minimumStock: 30, lot: "DEMO-CZ-VENCIDO", expiresAt: isoDate(-5), code: "103-02-0403", active: true, lots: [
      { id: "demo-cz-1", lot: "DEMO-CZ-VENCIDO", expiresAt: isoDate(-5), quantity: 6, receivedAt: isoTime(500) },
      { id: "demo-cz-2", lot: "DEMO-CZ-PROXIMO", expiresAt: isoDate(20), quantity: 30, receivedAt: isoTime(400) },
      { id: "demo-cz-3", lot: "DEMO-CZ-VIGENTE", expiresAt: isoDate(198), quantity: 60, receivedAt: isoTime(300) },
    ] },
    { id: "demo-morfina", name: "Morfina", strength: "10 mg/mL", form: "Solución inyectable", unit: "ampollas", stock: 8, minimumStock: 15, lot: "MF-7805", expiresAt: isoDate(9), code: "104-10-7805", active: true },
    { id: "demo-levotiroxina", name: "Levotiroxina", strength: "100 mcg", form: "Tableta", unit: "unidades", stock: 184, minimumStock: 50, lot: "LV-3348", expiresAt: isoDate(290), code: "105-10-3348", active: true },
    { id: "demo-salbutamol", name: "Salbutamol", strength: "100 mcg/dosis", form: "Inhalador", unit: "unidades", stock: 42, minimumStock: 20, lot: "SB-9087", expiresAt: isoDate(-3), code: "106-10-9087", active: true },
  ],
  pharmacists: [
    { id: "demo-ph-1", name: "María Gómez", email: "maria.gomez@demo.local", license: "CF-2841", active: true },
    { id: "demo-ph-2", name: "Carlos Rodríguez", email: "carlos.rodriguez@demo.local", license: "CF-3156", active: true },
  ],
  movements: [
    { id: "demo-mov-1", medicineId: "demo-metformina", medicineName: "Metformina", type: "OUT", quantity: 30, prescriptionRef: "RX-DEMO-00481", pharmacistEmail: "maria.gomez@demo.local", createdAt: isoTime(1) },
    { id: "demo-mov-2", medicineId: "demo-insulina", medicineName: "Insulina glargina", type: "IN", quantity: 10, prescriptionRef: "Ingreso de proveedor", pharmacistEmail: "carlos.rodriguez@demo.local", createdAt: isoTime(3) },
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
  state = { ...state, medicines: state.medicines.map((m) => m.id === medicineId ? { ...m, ...fields } : m) }; emit();
}

export function demoCreateMedicine(fields: Omit<Medicine, "id" | "unit" | "stock">, stock: number) {
  state = { ...state, medicines: [...state.medicines, { ...fields, id: id("demo-med"), unit: "unidades", stock }] }; emit();
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

export function demoRegisterMovement(input: Omit<Movement, "id" | "medicineName">, receivedLots?: ReceivedLot[]) {
  const medicine = state.medicines.find((m) => m.id === input.medicineId);
  if (!medicine) throw new Error("Medicamento no disponible.");
  if (input.type !== "IN" && input.type !== "OUT") throw new Error("Tipo de movimiento inválido.");
  const prepared = prepareMovement(medicine, { medicineId: medicine.id, type: input.type, quantity: input.quantity, prescriptionRef: input.prescriptionRef, note: input.note, pharmacistEmail: input.pharmacistEmail, createdAt: input.createdAt });
  const lots: InventoryLot[] = medicine.lots?.length ? structuredClone(medicine.lots) : medicine.stock > 0 ? [{ id: `legacy-${medicine.id}`, lot: medicine.lot || "SIN-LOTE", expiresAt: medicine.expiresAt || "", quantity: medicine.stock, receivedAt: input.createdAt }] : [];
  const allocations: LotAllocation[] = [];
  if (input.type === "IN") {
    if (!receivedLots?.length) throw new Error("Registre al menos un lote para el ingreso.");
    if (receivedLots.reduce((sum, lot) => sum + lot.quantity, 0) !== input.quantity) throw new Error("La cantidad no coincide con los lotes recibidos.");
    for (const incoming of receivedLots) {
      const lotId = id("demo-lot");
      lots.push({ ...incoming, id: lotId, receivedAt: input.createdAt });
      allocations.push({ ...incoming, lotId });
    }
  } else {
    let remaining = input.quantity;
    for (const lot of [...lots].filter((item) => item.quantity > 0).sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999") || a.receivedAt.localeCompare(b.receivedAt))) {
      if (!remaining) break;
      const used = Math.min(remaining, lot.quantity);
      lot.quantity -= used;
      remaining -= used;
      allocations.push({ lotId: lot.id, lot: lot.lot, expiresAt: lot.expiresAt, quantity: used });
    }
    if (remaining) throw new Error("Existencias por lote insuficientes.");
  }
  const first = lots.filter((lot) => lot.quantity > 0).sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999"))[0];
  const record: Movement = { ...input, lotAllocations: allocations, id: id("demo-mov"), medicineName: medicine.name };
  state = {
    medicines: state.medicines.map((m) => m.id === medicine.id ? { ...m, stock: prepared.nextStock, lots, lot: first?.lot || "", expiresAt: first?.expiresAt || "" } : m),
    pharmacists: state.pharmacists,
    movements: [record, ...state.movements],
  };
  emit();
}

export function demoRegisterCount(record: Omit<Movement, "id">) {
  state = { ...state, movements: [{ ...record, id: id("demo-count") }, ...state.movements] }; emit();
}
