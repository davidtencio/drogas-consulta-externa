import { describe, expect, it } from "vitest";
import { fieldForFormError, parseMedicineForm, parseMovementForm, parsePharmacistForm } from "./forms";

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
    expect(fieldForFormError("pharmacist", "El código profesional es inválido.")).toBe("license");
  });
});
