import { describe, expect, it } from "vitest";
import { inventoryViewToCsv } from "./csv";
import type { Medicine } from "./inventory";

describe("CSV de la vista del inventario", () => {
  it("exporta la fecha del lote con saldo y conserva la cantidad general sin corregir discrepancias", () => {
    const medicine: Medicine = { id: "a", name: "DEMO", strength: "2 mg", form: "Tableta", stock: 20, minimumStock: 10, unit: "tabletas", lot: "AGOTADO", expiresAt: "2000-01-01", lots: [{ id: "old", lot: "AGOTADO", quantity: 0, expiresAt: "2000-01-01", receivedAt: "" }, { id: "actual", lot: "ACTUAL", quantity: 15, expiresAt: "2099-01-01", receivedAt: "" }] };
    const csv = inventoryViewToCsv([medicine]);
    expect(csv).toContain("20,tabletas,10,2099-01-01,ACTUAL,Lotes almacenados,Sí");
    expect(csv).not.toContain("2000-01-01");
  });
});
