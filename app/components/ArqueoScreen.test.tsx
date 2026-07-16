import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Medicine, Pharmacist } from "../lib/inventory";

const registerCounts = vi.fn(async () => undefined);
vi.mock("../lib/db", () => ({ registerCounts: (...a: unknown[]) => registerCounts(...a) }));

const med = (o: Partial<Medicine>): Medicine => ({
  id: "1", name: "Med", strength: "1", form: "Tableta", unit: "u", stock: 0, minimumStock: 0, lot: "", expiresAt: "", active: true, ...o,
});
const pharm: Pharmacist = { id: "p1", name: "Ana Rojas", email: "ana@h.cr", license: "CF-1", active: true };

const data = {
  medicines: [med({ id: "a", name: "Metformina", stock: 100 }), med({ id: "b", name: "Ibuprofeno", stock: 40 })],
  pharmacists: [pharm],
  movements: [],
  pendingWrites: false,
};
vi.mock("../hooks/useInventoryData", () => ({ useInventoryData: () => data }));
vi.mock("../hooks/useOnline", () => ({ useOnline: () => true }));

import { ArqueoScreen } from "./ArqueoScreen";

beforeEach(() => registerCounts.mockClear());

describe("ArqueoScreen", () => {
  it("lista los medicamentos activos con su stock de sistema", () => {
    render(<ArqueoScreen email="op@h.cr" />);
    expect(screen.getByText("Metformina")).toBeInTheDocument();
    expect(screen.getByText("Ibuprofeno")).toBeInTheDocument();
    expect(screen.getByText("0 contados de 2")).toBeInTheDocument();
  });

  it("registra solo los medicamentos con físico ingresado", async () => {
    render(<ArqueoScreen email="op@h.cr" />);
    const inputs = screen.getAllByLabelText("Físico");
    await userEvent.type(inputs[0], "98"); // solo Metformina
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    expect(screen.getByText("1 contado de 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Registrar arqueo/ }));
    expect(registerCounts).toHaveBeenCalledOnce();
    const [entries, , pharmacistEmail] = registerCounts.mock.calls[0];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ countedQuantity: 98, medicine: { id: "a" } });
    expect(pharmacistEmail).toBe("ana@h.cr");
  });

  it("no permite registrar sin farmacéutico responsable", async () => {
    render(<ArqueoScreen email="op@h.cr" />);
    await userEvent.type(screen.getAllByLabelText("Físico")[0], "98");
    expect(screen.getByRole("button", { name: /Registrar arqueo/ })).toBeDisabled();
  });
});
