import { describe, expect, it } from "vitest";
import { buildMovementsReport, formatReportDay, reportPeriod } from "./movementsReport";
import type { Movement } from "./inventory";

const mov = (o: Partial<Movement> = {}): Movement => ({
  id: "m1", medicineId: "med1", type: "OUT", quantity: 5, medicineName: "Morfina", prescriptionRef: "RX-1",
  pharmacistEmail: "ana@h.cr", createdAt: "2026-10-02T15:30:00.000Z", ...o,
});
const base = { generatedBy: "David", timeZone: "UTC", now: new Date("2026-11-19T17:00:00.000Z") };

describe("reportPeriod", () => {
  it("describe el rango sin desplazar el día", () => {
    expect(formatReportDay("2026-10-01")).toMatch(/^1 oct 2026$/);
    expect(reportPeriod("2026-10-01", "2026-10-10")).toMatch(/^Del 1 oct 2026 al 10 oct 2026$/);
    expect(reportPeriod("2026-10-01", "")).toMatch(/^Desde el 1 oct 2026$/);
    expect(reportPeriod("", "2026-10-10")).toMatch(/^Hasta el 10 oct 2026$/);
    expect(reportPeriod()).toBe("Historial completo");
  });
});

describe("buildMovementsReport", () => {
  it("resume operaciones y excluye los anulados de los totales", () => {
    const report = buildMovementsReport([
      mov({ id: "a", type: "IN", quantity: 20 }),
      mov({ id: "b", quantity: 5 }),
      mov({ id: "c", quantity: 7, voidedAt: "2026-10-03T10:00:00.000Z", voidReason: "Receta duplicada", voidedByEmail: "luis@h.cr" }),
      mov({ id: "d", type: "COUNT", quantity: 18, systemQuantity: 20, difference: -2, note: "Ampolla quebrada", prescriptionRef: "" }),
    ], { ...base, medicine: { name: "Morfina 10 mg/mL", unit: "ampollas" }, resolvePharmacist: (e) => (e === "luis@h.cr" ? "Luis Mora" : e) });
    const byLabel = Object.fromEntries(report.summary.map((c) => [c.label, c]));
    expect(byLabel.Registros.value).toBe("4");
    expect(byLabel.Ingresos).toMatchObject({ value: "1", detail: "20 ampollas" });
    expect(byLabel.Egresos).toMatchObject({ value: "1", detail: "5 ampollas" });
    expect(byLabel.Anulados.value).toBe("1");
    expect(byLabel.Conteos.value).toBe("1");
    expect(report.title).toBe("Movimientos de Morfina 10 mg/mL");
    expect(report.filters).toContainEqual({ label: "Medicamento", value: "Morfina 10 mg/mL" });
    const voided = report.rows[2];
    expect(voided).toMatchObject({ status: "Anulado", voided: true });
    expect(voided.details.join(" ")).toMatch(/por Luis Mora\. Motivo: Receta duplicada/);
    expect(report.rows[3].details).toEqual(["Sistema: 20 · Diferencia: -2", "Observación: Ampolla quebrada"]);
    expect(report.rows[3].prescription).toBe("—");
  });

  it("muestra fechas, lotes, unidades, ediciones y el responsable resuelto", () => {
    const [row] = buildMovementsReport([
      mov({ lotAllocations: [{ lotId: "l", lot: "L-1", expiresAt: "2027-01-01", quantity: 5 }], editHistory: [{ editedAt: "x", editedByEmail: "y", previous: mov() }] }),
    ], { ...base, units: new Map([["med1", "ampollas"]]), resolvePharmacist: () => "Ana Rojas" }).rows;
    expect(row).toMatchObject({ date: "02/10/2026, 15:30", lots: "L-1: 5", quantity: "5 ampollas", responsible: "Ana Rojas", type: "Egreso", status: "Vigente" });
    expect(row.details).toEqual(["Editado 1 vez"]);
  });

  it("lista solo los filtros aplicados", () => {
    expect(buildMovementsReport([], { ...base, type: "ALL", text: " " }).filters).toEqual([]);
    expect(buildMovementsReport([], { ...base, type: "IN", text: "lote 9", pharmacist: "Ana" }).filters).toEqual([
      { label: "Tipo", value: "Ingresos" }, { label: "Responsable", value: "Ana" }, { label: "Búsqueda", value: "“lote 9”" },
    ]);
  });
});
