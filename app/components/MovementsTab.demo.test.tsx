import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { getDocs, download } = vi.hoisted(() => ({ getDocs: vi.fn(), download: vi.fn() }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), getDocs, orderBy: vi.fn(), query: vi.fn() }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("../lib/download", () => ({ dateStamp: () => "2026-10-17", downloadTextFile: download }));
vi.mock("../lib/demo", async (original) => ({ ...await original<typeof import("../lib/demo")>(), DEMO_MODE: true }));
import { getDemoSnapshot, resetDemoStore } from "../lib/demo";
import { MovementsTab } from "./MovementsTab";

beforeEach(() => { resetDemoStore(); vi.clearAllMocks(); });
describe("exportación de movimientos DEMO", () => {
  it("exporta con los filtros elegidos sin consultar Firestore", async () => {
    const demo = getDemoSnapshot();
    render(<MovementsTab {...demo} pharmacistNames={new Map()} onNotice={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por tipo"), "OUT");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(getDocs).not.toHaveBeenCalled();
    expect(download.mock.calls[0][1]).toContain("RX-DEMO-00481");
    expect(download.mock.calls[0][1]).not.toContain("Ingreso de proveedor");
  });
});
