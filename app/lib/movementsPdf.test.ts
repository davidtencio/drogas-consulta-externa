// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildMovementsReport } from "./movementsReport";
import { renderMovementsPdf } from "./movementsPdf";
import type { Movement } from "./inventory";

describe("renderMovementsPdf", () => {
  it("genera un PDF de varias páginas con el total de páginas resuelto", async () => {
    const movements: Movement[] = Array.from({ length: 40 }, (_, i) => ({
      id: String(i), type: i % 2 ? "OUT" : "IN", quantity: i + 1, medicineName: "Clonazepam 2 mg", prescriptionRef: `RX-${i}`,
      pharmacistEmail: "ana@h.cr", createdAt: "2026-10-02T15:30:00.000Z",
      ...(i === 3 ? { voidedAt: "2026-10-03T10:00:00.000Z", voidReason: "Receta duplicada" } : {}),
    }));
    const blob = await renderMovementsPdf(buildMovementsReport(movements, { from: "2026-10-01", to: "2026-10-10", generatedBy: "Ana Rojas" }));
    const text = Buffer.from(await blob.arrayBuffer()).toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).not.toContain("{total_pages}");
    expect(text).toContain("RX-39");
  });
});
