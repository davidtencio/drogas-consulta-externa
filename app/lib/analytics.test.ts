import { describe, expect, it } from "vitest";
import type { Movement } from "./inventory";
import { periodStart, rankVoidedMedicines, rankVoidingPharmacists, voidTotals } from "./analytics";

const base = { prescriptionRef: "RX", pharmacistEmail: "resp@x.cr", createdAt: "2026-10-01T10:00:00.000Z" };
// La cuenta con sesión iniciada que anula o edita es siempre la misma; el ranking
// debe contar al farmacéutico responsable del movimiento, no a esa cuenta.
const SESSION = "sesion@x.cr";
const out = (id: string, medicineId: string, medicineName: string, quantity: number, voidedAt?: string, pharmacistEmail = base.pharmacistEmail): Movement =>
  ({ ...base, id, type: "OUT", medicineId, medicineName, quantity, pharmacistEmail, ...(voidedAt ? { voidedAt, voidedByEmail: SESSION, voidReason: "Error de digitación" } : {}) });

const movements: Movement[] = [
  out("1", "morf", "Morfina", 2, "2026-11-01T10:00:00.000Z", "Ana@x.cr"),
  out("2", "morf", "Morfina", 3, "2026-10-20T10:00:00.000Z", "beto@x.cr"),
  out("3", "clon", "Clonazepam", 30, "2026-11-02T10:00:00.000Z", "ana@x.cr"),
  out("4", "clon", "Clonazepam", 10), // vigente: no cuenta
  out("5", "metf", "Metformina", 5, "2025-01-01T10:00:00.000Z", "beto@x.cr"), // fuera de 30 días
  {
    ...base, id: "6", type: "IN", medicineId: "metf", medicineName: "Metformina", quantity: 100,
    updatedAt: "2026-11-02T12:00:00.000Z",
    editHistory: [
      { editedAt: "2026-10-30T09:00:00.000Z", editedByEmail: SESSION, previous: { type: "IN", quantity: 10, medicineName: "Metformina", prescriptionRef: "RX", pharmacistEmail: "beto@x.cr" } },
      { editedAt: "2026-11-02T12:00:00.000Z", editedByEmail: SESSION, previous: { type: "IN", quantity: 1000, medicineName: "Metformina", prescriptionRef: "RX", pharmacistEmail: "beto@x.cr" } },
    ],
  },
  {
    // egreso editado: no es un ingreso corregido
    ...base, id: "7", type: "OUT", medicineId: "metf", medicineName: "Metformina", quantity: 1,
    editHistory: [{ editedAt: "2026-11-02T12:00:00.000Z", editedByEmail: SESSION, previous: { type: "OUT", quantity: 2, medicineName: "Metformina", prescriptionRef: "RX", pharmacistEmail: "resp@x.cr" } }],
  },
];

const since = periodStart("30d", new Date("2026-11-03T00:00:00.000Z"));

describe("periodStart", () => {
  it("resta los días del período y devuelve null para todo el historial", () => {
    expect(since).toBe("2026-10-04T00:00:00.000Z");
    expect(periodStart("all")).toBeNull();
  });
});

describe("rankVoidedMedicines", () => {
  it("cuenta solo egresos anulados dentro del período, ordenados por anulaciones y unidades", () => {
    expect(rankVoidedMedicines(movements, since)).toEqual([
      { key: "morf", medicineId: "morf", medicineName: "Morfina", voids: 2, quantity: 5, lastAt: "2026-11-01T10:00:00.000Z" },
      { key: "clon", medicineId: "clon", medicineName: "Clonazepam", voids: 1, quantity: 30, lastAt: "2026-11-02T10:00:00.000Z" },
    ]);
  });

  it("sin período incluye anulaciones antiguas", () => {
    expect(rankVoidedMedicines(movements).map((r) => r.key)).toEqual(["morf", "clon", "metf"]);
  });

  it("agrupa por nombre cuando el egreso no tiene medicineId", () => {
    const rows = rankVoidedMedicines([{ ...out("x", "", "Tramadol", 4, "2026-11-01T00:00:00.000Z", "a@x.cr"), medicineId: undefined }]);
    expect(rows[0]).toMatchObject({ key: "Tramadol", voids: 1, quantity: 4 });
  });
});

describe("rankVoidingPharmacists", () => {
  it("suma egresos anulados e ingresos corregidos por responsable, sin distinguir mayúsculas ni contar la cuenta con sesión", () => {
    expect(rankVoidingPharmacists(movements, since)).toEqual([
      { email: "beto@x.cr", voidedOut: 1, correctedIn: 2, total: 3, lastAt: "2026-11-02T12:00:00.000Z" },
      { email: "ana@x.cr", voidedOut: 2, correctedIn: 0, total: 2, lastAt: "2026-11-02T10:00:00.000Z" },
    ]);
  });

  it("desempata por egresos anulados", () => {
    const rows = rankVoidingPharmacists([
      out("a", "m", "M", 1, "2026-11-01T00:00:00.000Z", "z@x.cr"),
      { ...base, id: "b", type: "IN", medicineName: "M", quantity: 1, pharmacistEmail: "a@x.cr", editHistory: [{ editedAt: "2026-11-01T00:00:00.000Z", editedByEmail: SESSION, previous: { type: "IN", quantity: 2, medicineName: "M", prescriptionRef: "", pharmacistEmail: "" } }] },
    ]);
    // Sin responsable en la versión anterior, cuenta el responsable actual.
    expect(rows.map((r) => r.email)).toEqual(["z@x.cr", "a@x.cr"]);
  });
});

describe("voidTotals", () => {
  it("resume medicamentos, unidades, correcciones y personas", () => {
    expect(voidTotals(rankVoidedMedicines(movements, since), rankVoidingPharmacists(movements, since)))
      .toEqual({ voidedOut: 3, voidedQuantity: 35, correctedIn: 2, medicines: 2, people: 2 });
  });
});
