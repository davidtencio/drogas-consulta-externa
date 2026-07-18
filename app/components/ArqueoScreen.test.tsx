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
    expect(screen.getByText("0 confirmados de 2")).toBeInTheDocument();
  });

  it("confirma el saldo con la casilla y registra el físico = sistema", async () => {
    render(<ArqueoScreen email="op@h.cr" />);
    await userEvent.click(screen.getByLabelText("Confirmar saldo de Metformina"));
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    expect(screen.getByText("1 confirmado de 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Registrar toma/ }));
    expect(registerCounts).toHaveBeenCalledOnce();
    const [entries, , pharmacistEmail] = registerCounts.mock.calls[0];
    expect(entries).toHaveLength(1);
    // El físico confirmado coincide con el sistema (100), sin ingreso manual.
    expect(entries[0]).toMatchObject({ countedQuantity: 100, medicine: { id: "a", stock: 100 } });
    expect(pharmacistEmail).toBe("ana@h.cr");
  });

  it("'Confirmar todos' selecciona todo el inventario", async () => {
    render(<ArqueoScreen email="op@h.cr" />);
    await userEvent.click(screen.getByLabelText("Confirmar todos"));
    expect(screen.getByText("2 confirmados de 2")).toBeInTheDocument();
  });

  it("no permite registrar sin farmacéutico responsable", async () => {
    render(<ArqueoScreen email="op@h.cr" />);
    await userEvent.click(screen.getByLabelText("Confirmar saldo de Metformina"));
    expect(screen.getByRole("button", { name: /Registrar toma/ })).toBeDisabled();
  });
});
