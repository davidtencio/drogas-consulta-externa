import { describe, expect, it } from "vitest";
import { fieldForFormError, parseCountForm, parseMedicineForm, parseMovementForm, parsePharmacistForm } from "./forms";

function makeForm(entries: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((v) => form.append(key, v));
    else form.set(key, value);
  }
  return form;
}

describe("parsers de formularios y asociación de errores", () => {
  it("parseMedicineForm valida existencia inicial, lote, vencimiento y farmacéutico", () => {
    expect(() =>
      parseMedicineForm(makeForm({ name: "Metformina", strength: "500 mg", stock: "5", lot: "", expiresAt: "2027-01-01", pharmacistEmail: "ana@h.cr" }), null)
    ).toThrow(/lote/i);
    expect(() =>
      parseMedicineForm(makeForm({ name: "Metformina", strength: "500 mg", stock: "5", lot: "L1", expiresAt: "", pharmacistEmail: "ana@h.cr" }), null)
    ).toThrow(/vencimiento/i);
    const ok = parseMedicineForm(
      makeForm({ name: "Metformina", strength: "500 mg", stock: "5", lot: "L1", expiresAt: "2027-01-01", pharmacistEmail: "ana@h.cr" }),
      null
    );
    expect(ok).toMatchObject({ kind: "create", initialStock: 5, pharmacistEmail: "ana@h.cr" });
  });

  it("parsePharmacistForm normaliza el correo a minúsculas", () => {
    expect(parsePharmacistForm(makeForm({ name: "Ana", email: "ANA@H.CR", license: "CF-1" }))).toEqual({
      name: "Ana",
      email: "ana@h.cr",
      license: "CF-1",
    });
  });

  it("parseMovementForm suma la cantidad de los lotes recibidos en ingresos", () => {
    const parsed = parseMovementForm(
      makeForm({
        medicineId: "m1",
        type: "IN",
        lotNumber: ["L1", "L2"],
        lotExpiresAt: ["2027-01-01", "2028-01-01"],
        lotQuantity: ["10", "15"],
        pharmacistEmail: "ana@h.cr",
      })
    );
    expect(parsed.quantity).toBe(25);
    expect(parsed.receivedLots).toHaveLength(2);
  });

  it("fieldForFormError distingue campos de medicamento, movimiento y farmacéutico", () => {
    expect(fieldForFormError("medicine", "Indique el lote del ingreso inicial.")).toBe("lot");
    expect(fieldForFormError("medicine", "Indique el vencimiento del ingreso inicial.")).toBe("expiresAt");
    expect(fieldForFormError("movement", "Existencias insuficientes.")).toBe("quantity");
    expect(fieldForFormError("movement", "El lote seleccionado está vencido.")).toBe("targetLotId");
    expect(fieldForFormError("count", "La cantidad contada debe ser un número entero (0 o más).")).toBe("countedQuantity");
    expect(fieldForFormError("pharmacist", "El código profesional es inválido.")).toBe("license");
  });

  it("parseMovementForm incluye targetLotId y allowExpired en egresos cuando se indican", () => {
    const parsed = parseMovementForm(
      makeForm({
        medicineId: "m1",
        type: "OUT",
        quantity: "5",
        targetLotId: "lot-vencido",
        allowExpired: "true",
        pharmacistEmail: "ana@h.cr",
      })
    );
    expect(parsed).toMatchObject({
      medicineId: "m1",
      type: "OUT",
      quantity: 5,
      targetLotId: "lot-vencido",
      allowExpired: true,
    });
  });

  it("parseCountForm toma countedQuantity cuando se ingresa o usa el stock del sistema por defecto", () => {
    const med = { id: "m1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades", stock: 50, minimumStock: 10, lot: "L1", expiresAt: "2099-01-01" };
    expect(parseCountForm(makeForm({ pharmacistEmail: "ana@h.cr" }), med).countedQuantity).toBe(50);
    expect(parseCountForm(makeForm({ pharmacistEmail: "ana@h.cr", countedQuantity: "47" }), med).countedQuantity).toBe(47);
    expect(() => parseCountForm(makeForm({ pharmacistEmail: "ana@h.cr", countedQuantity: "-1" }), med)).toThrow(/cantidad contada/i);
  });
});

