import type { Medicine, Movement, Pharmacist } from "./inventory";

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
    { id: "demo-clonazepam", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "unidades", stock: 96, minimumStock: 30, lot: "CZ-4021", expiresAt: isoDate(198), code: "103-02-0403", active: true },
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

export function demoRegisterMovement(input: Omit<Movement, "id" | "medicineName">) {
  const medicine = state.medicines.find((m) => m.id === input.medicineId);
  if (!medicine) throw new Error("Medicamento no disponible.");
  const delta = input.type === "IN" ? input.quantity : -input.quantity;
  if (medicine.stock + delta < 0) throw new Error("Existencias insuficientes.");
  const record: Movement = { ...input, id: id("demo-mov"), medicineName: medicine.name };
  state = {
    medicines: state.medicines.map((m) => m.id === medicine.id ? { ...m, stock: m.stock + delta } : m),
    pharmacists: state.pharmacists,
    movements: [record, ...state.movements],
  };
  emit();
}

export function demoRegisterCount(record: Omit<Movement, "id">) {
  state = { ...state, movements: [{ ...record, id: id("demo-count") }, ...state.movements] }; emit();
}
