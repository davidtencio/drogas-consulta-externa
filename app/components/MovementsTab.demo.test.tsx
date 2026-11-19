import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { getDocs, download, renderPdf } = vi.hoisted(() => ({ getDocs: vi.fn(), download: vi.fn(), renderPdf: vi.fn(async () => new Blob(["%PDF"])) }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), getDocs, orderBy: vi.fn(), query: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../lib/download", () => ({ dateStamp: () => "2026-10-17", downloadBlob: download }));
vi.mock("../lib/movementsPdf", () => ({ renderMovementsPdf: renderPdf }));
vi.mock("../lib/demo", async (original) => ({ ...await original<typeof import("../lib/demo")>(), DEMO_MODE: true }));
import { getDemoSnapshot, resetDemoStore } from "../lib/demo";
import type { MovementsReport } from "../lib/movementsReport";
import { MovementsTab } from "./MovementsTab";

beforeEach(() => { resetDemoStore(); vi.clearAllMocks(); });
describe("exportación de movimientos DEMO", () => {
  it("genera el reporte PDF con los filtros elegidos sin consultar Firestore", async () => {
    const demo = getDemoSnapshot();
    const onNotice = vi.fn();
    render(<MovementsTab {...demo} pharmacistNames={new Map([["ana@demo.local", "Ana Rojas"]])} onNotice={onNotice} reportAuthor="ana@demo.local" />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por tipo"), "OUT");
    await userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(getDocs).not.toHaveBeenCalled();
    expect(download.mock.calls[0][0]).toBe("movimientos_2026-10-17.pdf");
    const report = renderPdf.mock.calls[0][0] as unknown as MovementsReport;
    expect(report.generatedBy).toBe("Ana Rojas");
    expect(report.filters).toContainEqual({ label: "Tipo", value: "Egresos" });
    expect(report.rows.map((r) => r.prescription)).toContain("RX-DEMO-00481");
    expect(report.rows.map((r) => r.prescription)).not.toContain("Ingreso de proveedor");
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/Reporte PDF generado/));
  });
});
