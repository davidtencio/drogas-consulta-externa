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
});
