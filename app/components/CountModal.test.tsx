import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountModal } from "./CountModal";
import type { Medicine, Pharmacist } from "../lib/inventory";

const med: Medicine = {
  id: "m1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades",
  stock: 100, minimumStock: 10, lot: "L1", expiresAt: "2099-01-01", active: true,
};
const pharm: Pharmacist = { id: "p1", name: "Ana Rojas", email: "ana@h.cr", license: "CF-1", active: true };

function base(over: Partial<Parameters<typeof CountModal>[0]> = {}) {
  return {
    medicine: med, activePharmacists: [pharm], busy: false,
    onClose: vi.fn(), onSubmit: vi.fn((e) => e.preventDefault()), ...over,
  };
}

describe("CountModal", () => {
  it("muestra el medicamento y las existencias en sistema", () => {
    render(<CountModal {...base()} />);
    expect(screen.getByRole("heading", { name: "Confirmar saldo" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Metformina 500 mg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100 unidades")).toBeInTheDocument();
  });

  it("mantiene deshabilitado el botón hasta marcar la casilla", async () => {
    render(<CountModal {...base()} />);
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    expect(screen.getByRole("button", { name: "Confirmar saldo" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Confirmar saldo" })).toBeEnabled();
  });

  it("envía el formulario con la acción 'count' al confirmar", async () => {
    const props = base();
    render(<CountModal {...props} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar saldo" }));
    expect(props.onSubmit).toHaveBeenCalled();
    expect(props.onSubmit.mock.calls[0][1]).toBe("count");
  });

  it("sin farmacéuticos avisa y deshabilita", () => {
    render(<CountModal {...base({ activePharmacists: [] })} />);
    expect(screen.getByText(/Registre un farmacéutico autorizado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar saldo" })).toBeDisabled();
  });

  it("enlaza el error al selector responsable", () => {
    render(<CountModal {...base({ error: "Seleccione el farmacéutico responsable.", errorField: "pharmacistEmail" })} />);
    const field = screen.getByLabelText("Farmacéutico responsable");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
  });

  it("permite conciliar diferencias abriendo un ingreso o egreso del medicamento", async () => {
    const onAdjust = vi.fn();
    render(<CountModal {...base({ onAdjust })} />);
    await userEvent.click(screen.getByRole("button", { name: "Registrar faltante (egreso)" }));
    expect(onAdjust).toHaveBeenCalledWith("m1", "OUT");
    await userEvent.click(screen.getByRole("button", { name: "Registrar sobrante (ingreso)" }));
    expect(onAdjust).toHaveBeenCalledWith("m1", "IN");
  });

  it("permite indicar una cantidad física distinta y muestra la diferencia frente al sistema", async () => {
    render(<CountModal {...base()} />);
    const input = screen.getByLabelText("Cantidad física contada");
    expect(input).toHaveValue(100);
    await userEvent.clear(input);
    await userEvent.type(input, "96");
    expect(screen.getByText(/Diferencia frente al sistema:/)).toHaveTextContent("-4 unidades");
  });
});
