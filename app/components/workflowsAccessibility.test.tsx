import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Modals, type ModalState } from "./Modals";
import { CountModal } from "./CountModal";
import { SettingsTab } from "./SettingsTab";

const medicine = { id: "m1", name: "Presentación DEMO", strength: "1 mg", form: "Tableta", unit: "unidades", stock: 10, minimumStock: 2, lot: "DEMO", expiresAt: "2099-01-01", active: true };
const pharmacist = { id: "p1", name: "Responsable DEMO", email: "demo@demo.local", license: "CF-DEMO", active: true };
const states: ModalState[] = [{ kind: "movement", type: "IN" }, { kind: "medicine", editing: null }, { kind: "pharmacist", editing: null }];

describe("accesibilidad automática de los flujos de fase 5", () => {
  it.each(states)("expone campos y secciones del formulario $kind sin infracciones axe", async (state) => {
    const { container } = render(<Modals state={state} activeMeds={[medicine]} activePharmacists={[pharmacist]} busy={false} online onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
  it("expone la confirmación de saldo y sus acciones sin infracciones axe", async () => {
    const { container } = render(<CountModal medicine={medicine} activePharmacists={[pharmacist]} busy={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
  it("expone los filtros y grupos de acciones de configuración sin infracciones axe", async () => {
    const { container } = render(<SettingsTab medicines={[medicine]} pharmacists={[pharmacist]} onCreate={vi.fn()} onEdit={vi.fn()} onSetActive={vi.fn()} onMovement={vi.fn()} onCount={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
