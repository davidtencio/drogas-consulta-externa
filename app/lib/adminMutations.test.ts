import { describe, it, expect } from "vitest";
import { planAdminMutation, type AdminOp, type WriteOp } from "./adminMutations";

const ctx = { actorEmail: "admin@h.cr", now: "2026-07-20T12:00:00.000Z", newId: "NEW1" };
const medFields = { name: "Metformina", strength: "500 mg", form: "Tableta", minimumStock: 20, lot: "L1", expiresAt: "2027-01-01", code: "101-20-5001" };
const phFields = { name: "Ana", email: "ana@h.cr", license: "CF-1" };

const audit = (writes: WriteOp[]) => writes.find((w) => w.collection === "auditLogs");

describe("planAdminMutation — medicine.create", () => {
  it("sin existencia inicial: medicamento + auditoría (sin movimiento)", () => {
    const writes = planAdminMutation({ op: "medicine.create", fields: medFields, initialStock: 0, pharmacistEmail: "" }, ctx);
    expect(writes).toHaveLength(2);
    expect(writes[0]).toMatchObject({ kind: "set", collection: "medicines", id: "NEW1", data: { stock: 0, active: true, unit: "unidades", createdAt: ctx.now } });
    expect(writes.some((w) => w.collection === "movements")).toBe(false);
    expect(audit(writes)?.data).toMatchObject({ action: "medicine.create", entityId: "NEW1", actorEmail: "admin@h.cr", createdAt: ctx.now });
  });

  it("con existencia inicial: medicamento + movimiento de ingreso + auditoría, todo en el lote", () => {
    const writes = planAdminMutation({ op: "medicine.create", fields: medFields, initialStock: 5, pharmacistEmail: "ana@h.cr" }, ctx);
    expect(writes).toHaveLength(3);
    const movement = writes.find((w) => w.collection === "movements");
    expect(movement).toMatchObject({ kind: "add", data: { type: "IN", quantity: 5, medicineId: "NEW1", pharmacistEmail: "ana@h.cr", prescriptionRef: "Existencia inicial", actorEmail: "admin@h.cr" } });
    expect(audit(writes)?.data).toMatchObject({ details: { initialStock: 5 } });
  });

  it("exige farmacéutico cuando la existencia inicial es > 0", () => {
    expect(() => planAdminMutation({ op: "medicine.create", fields: medFields, initialStock: 5, pharmacistEmail: "" }, ctx)).toThrow(/farmacéutico/i);
  });

  it("rechaza existencia inicial no entera o negativa", () => {
    expect(() => planAdminMutation({ op: "medicine.create", fields: medFields, initialStock: 2.5, pharmacistEmail: "ana@h.cr" }, ctx)).toThrow(/entero/i);
    expect(() => planAdminMutation({ op: "medicine.create", fields: medFields, initialStock: -1, pharmacistEmail: "ana@h.cr" }, ctx)).toThrow();
  });

  it("valida nombre/concentración y formato de código del lado servidor", () => {
    expect(() => planAdminMutation({ op: "medicine.create", fields: { ...medFields, name: "" }, initialStock: 0, pharmacistEmail: "" }, ctx)).toThrow(/obligatorios/i);
    expect(() => planAdminMutation({ op: "medicine.create", fields: { ...medFields, code: "123" }, initialStock: 0, pharmacistEmail: "" }, ctx)).toThrow(/000-00-0000/);
  });
});

describe("planAdminMutation — medicine.update", () => {
  it("actualiza el medicamento y registra la auditoría", () => {
    const writes = planAdminMutation({ op: "medicine.update", id: "m1", fields: medFields }, ctx);
    expect(writes[0]).toMatchObject({ kind: "update", collection: "medicines", id: "m1", data: { name: "Metformina" } });
    expect(audit(writes)?.data).toMatchObject({ action: "medicine.update", entityId: "m1" });
  });
});

describe("planAdminMutation — pharmacist", () => {
  it("crea con active=true y auditoría", () => {
    const writes = planAdminMutation({ op: "pharmacist.create", fields: phFields }, ctx);
    expect(writes[0]).toMatchObject({ kind: "set", collection: "pharmacists", id: "NEW1", data: { active: true, email: "ana@h.cr" } });
    expect(audit(writes)?.data).toMatchObject({ action: "pharmacist.create" });
  });

  it("valida datos requeridos del farmacéutico", () => {
    expect(() => planAdminMutation({ op: "pharmacist.create", fields: { ...phFields, license: "" } }, ctx)).toThrow(/farmacéutico/i);
  });
});

describe("planAdminMutation — setActive", () => {
  it("da de baja con la acción de auditoría correcta", () => {
    const writes = planAdminMutation({ op: "setActive", col: "pharmacists", id: "p1", active: false }, ctx);
    expect(writes[0]).toMatchObject({ kind: "update", collection: "pharmacists", id: "p1", data: { active: false } });
    expect(audit(writes)?.data).toMatchObject({ action: "pharmacist.deactivate", entityType: "pharmacist" });
  });

  it("reactiva un medicamento con la acción activate", () => {
    const writes = planAdminMutation({ op: "setActive", col: "medicines", id: "abc", active: true }, ctx);
    expect(audit(writes)?.data).toMatchObject({ action: "medicine.activate", entityType: "medicine" });
  });
});

describe("planAdminMutation — operación desconocida", () => {
  it("lanza error ante una operación no reconocida", () => {
    expect(() => planAdminMutation({ op: "bogus" } as unknown as AdminOp, ctx)).toThrow(/no reconocida/i);
  });
});
