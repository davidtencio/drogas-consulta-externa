import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryLot, Medicine } from "./inventory";
import { inventoryLotView, matchesInventoryFilter, selectInventory, summarizeInventory } from "./inventoryView";

const lot = (id: string, quantity: number, expiresAt: string): InventoryLot => ({ id, lot: id, quantity, expiresAt, receivedAt: "2026-01-01" });
const med = (fields: Partial<Medicine> = {}): Medicine => ({ id: "a", name: "Morfina", strength: "10 mg/mL", form: "Solución", unit: "ampollas", stock: 20, minimumStock: 10, lot: "ANTERIOR", expiresAt: "2028-01-01", ...fields });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 17, 12)); });
afterEach(() => vi.useRealTimers());

describe("proyección de lectura del inventario", () => {
  it("mantiene stock bajo inclusivo en el mínimo", () => {
    expect(matchesInventoryFilter(med({ stock: 10 }), "low")).toBe(true);
  });
  it("consulta el registro heredado sin modificarlo ni inventar recepción", () => {
    const medicine = med();
    const before = structuredClone(medicine);
    const view = inventoryLotView(medicine);
    expect(view.legacy).toBe(true);
    expect(view.lots[0]).toMatchObject({ lot: "ANTERIOR", quantity: 20, receivedAt: "" });
    expect(medicine).toEqual(before);
  });
  it("permite pertenecer a vencidos y próximos, una vez por categoría", () => {
    const medicine = med({ lots: [lot("V1", 5, "2026-09-30"), lot("V2", 5, "2026-10-01"), lot("P", 10, "2026-11-05")] });
    expect(summarizeInventory([medicine])).toMatchObject({ total: 1, expired: 1, soon: 1 });
    expect(inventoryLotView(medicine).nearest).toBe("2026-09-30");
  });
  it("excluye lotes agotados de alertas y no recupera la fecha resumen sobre un desglose existente", () => {
    const medicine = med({ stock: 0, lots: [lot("V", 0, "2026-01-01")], expiresAt: "2026-01-01" });
    expect(inventoryLotView(medicine)).toMatchObject({ expired: false, soon: false, nearest: "", legacy: false });
  });
  it("señala fechas ausentes y discrepancias sin reparar el saldo", () => {
    const medicine = med({ lots: [lot("SIN-FECHA", 3, "")] });
    expect(inventoryLotView(medicine)).toMatchObject({ unknown: true, mismatch: true });
    expect(matchesInventoryFilter(medicine, "unknown")).toBe(true);
    expect(matchesInventoryFilter(medicine, "normal")).toBe(false);
    expect(medicine.stock).toBe(20);
  });
  it("conserva el vencimiento inclusivo de hoy y de 30 días", () => {
    expect(matchesInventoryFilter(med({ expiresAt: "2026-10-17" }), "soon")).toBe(true);
    expect(matchesInventoryFilter(med({ expiresAt: "2026-11-16" }), "soon")).toBe(true);
    expect(matchesInventoryFilter(med({ expiresAt: "2026-11-17" }), "soon")).toBe(false);
  });
  it("busca por código, forma sin acentos y lotes agotados", () => {
    const medicine = med({ code: "123-45-6789", lots: [lot("BUSCABLE", 0, "2026-01-01"), lot("ACTUAL", 20, "2028-01-01")] });
    for (const query of ["123-45", "solucion", "buscable"]) expect(selectInventory([medicine], query, "all", "name")).toEqual([medicine]);
  });
  it("combina búsqueda y filtro, ordena sin mutar y deja fechas desconocidas al final", () => {
    const medicines = [med({ id: "b", name: "B", expiresAt: "" }), med({ id: "a", name: "Ácido", stock: 10, expiresAt: "2028-01-01" })];
    expect(selectInventory(medicines, "acido", "low", "name").map((m) => m.id)).toEqual(["a"]);
    expect(selectInventory(medicines, "", "all", "expiry").map((m) => m.id)).toEqual(["a", "b"]);
    expect(medicines.map((m) => m.id)).toEqual(["b", "a"]);
  });
});
