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
    expect(screen.getByText("Registrar conteo físico")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Metformina 500 mg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100 unidades")).toBeInTheDocument();
  });

  it("calcula la diferencia en vivo (faltante)", async () => {
    render(<CountModal {...base()} />);
    await userEvent.type(screen.getByLabelText("Contado (físico)"), "95");
    expect(screen.getByText("Faltante -5")).toBeInTheDocument();
  });

  it("muestra sobrante cuando el físico supera al sistema", async () => {
    render(<CountModal {...base()} />);
    await userEvent.type(screen.getByLabelText("Contado (físico)"), "110");
    expect(screen.getByText("Sobrante +10")).toBeInTheDocument();
  });

  it("envía el formulario con la acción 'count'", async () => {
    const props = base();
    render(<CountModal {...props} />);
    await userEvent.type(screen.getByLabelText("Contado (físico)"), "100");
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    await userEvent.click(screen.getByRole("button", { name: "Registrar conteo" }));
    expect(props.onSubmit).toHaveBeenCalled();
    expect(props.onSubmit.mock.calls[0][1]).toBe("count");
  });

  it("sin farmacéuticos avisa y deshabilita", () => {
    render(<CountModal {...base({ activePharmacists: [] })} />);
    expect(screen.getByText(/Registre un farmacéutico autorizado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar conteo" })).toBeDisabled();
  });
});
