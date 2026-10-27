import { beforeEach, describe, expect, it } from "vitest";
import { demoRegisterMovement, getDemoSnapshot, resetDemoStore } from "./demo";

describe("almacén del modo demostración", () => {
  beforeEach(() => resetDemoStore());

  it("carga medicamentos, farmacéuticos y movimientos ficticios", () => {
    const state = getDemoSnapshot();
    expect(state.medicines.length).toBeGreaterThan(0);
    expect(state.pharmacists.length).toBeGreaterThan(0);
    expect(state.movements.length).toBeGreaterThan(0);
  });

  it("simula un egreso únicamente en memoria", () => {
    const before = getDemoSnapshot().medicines.find((m) => m.id === "demo-metformina")!.stock;
    demoRegisterMovement({ medicineId: "demo-metformina", type: "OUT", quantity: 5, prescriptionRef: "RX-PRUEBA", pharmacistEmail: "maria.gomez@demo.local", createdAt: new Date().toISOString() });
    const state = getDemoSnapshot();
    expect(state.medicines.find((m) => m.id === "demo-metformina")!.stock).toBe(before - 5);
    expect(state.movements[0]).toMatchObject({ medicineId: "demo-metformina", type: "OUT", quantity: 5 });
  });

  it("impide que un egreso deje existencias negativas", () => {
    expect(() => demoRegisterMovement({ medicineId: "demo-morfina", type: "OUT", quantity: 999, prescriptionRef: "RX-PRUEBA", pharmacistEmail: "maria.gomez@demo.local", createdAt: new Date().toISOString() })).toThrow("Existencias insuficientes");
  });
  it("mantiene el desglose de lotes al ingresar y egresar en memoria", () => {
    const request = { medicineId: "demo-clonazepam", type: "IN" as const, quantity: 4, prescriptionRef: "DEMO", pharmacistEmail: "maria.gomez@demo.local", createdAt: new Date().toISOString() };
    demoRegisterMovement(request, [{ lot: "DEMO-NUEVO", quantity: 4, expiresAt: "2099-01-01" }]);
    let medicine = getDemoSnapshot().medicines.find((item) => item.id === request.medicineId)!;
    expect(medicine.stock).toBe(100);
    expect(medicine.lots?.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(100);
    demoRegisterMovement({ ...request, type: "OUT", quantity: 1 });
    medicine = getDemoSnapshot().medicines.find((item) => item.id === request.medicineId)!;
    expect(medicine.stock).toBe(99);
    expect(medicine.lots?.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(99);
    expect(getDemoSnapshot().movements[0].lotAllocations?.[0].quantity).toBe(1);
  });
});
