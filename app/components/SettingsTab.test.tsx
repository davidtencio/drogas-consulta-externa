import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsTab } from "./SettingsTab";
import type { Medicine, Pharmacist } from "../lib/inventory";

const medicine: Medicine = {
  id: "med1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades",
  stock: 100, minimumStock: 20, lot: "L1", expiresAt: "2099-01-01", active: true,
};
const pharmacist: Pharmacist = { id: "ph1", name: "Ana Rojas", email: "ana@h.cr", license: "CF-1", active: true };

function setup(over: Partial<Parameters<typeof SettingsTab>[0]> = {}) {
  const props = {
    medicines: [medicine],
    pharmacists: [pharmacist],
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onSetActive: vi.fn(),
    ...over,
  };
  render(<SettingsTab {...props} />);
  return props;
}

describe("SettingsTab", () => {
  it("lista medicamentos y farmacéuticos", () => {
    setup();
    expect(screen.getByText("Metformina")).toBeInTheDocument();
    expect(screen.getByText("Ana Rojas")).toBeInTheDocument();
  });

  it("crea con el tipo correcto", async () => {
    const { onCreate } = setup();
    await userEvent.click(screen.getAllByText("＋ Agregar")[0]);
    expect(onCreate).toHaveBeenCalledWith("medicine");
  });

  it("edita el medicamento", async () => {
    const { onEdit } = setup();
    await userEvent.click(screen.getAllByText("Editar")[0]);
    expect(onEdit).toHaveBeenCalledWith("medicine", medicine);
  });

  it("da de baja con active=false", async () => {
    const { onSetActive } = setup();
    await userEvent.click(screen.getAllByText("Dar de baja")[0]);
    expect(onSetActive).toHaveBeenCalledWith("medicines", "med1", false, "Metformina");
  });

  it("muestra estados vacíos", () => {
    setup({ medicines: [], pharmacists: [] });
    expect(screen.getByText("Registre el primer medicamento del catálogo.")).toBeInTheDocument();
    expect(screen.getByText("Registre al primer farmacéutico autorizado.")).toBeInTheDocument();
  });
});
