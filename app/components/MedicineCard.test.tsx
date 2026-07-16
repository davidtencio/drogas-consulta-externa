import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MedicineCard } from "./MedicineCard";
import type { Medicine } from "../lib/inventory";

function med(o: Partial<Medicine> = {}): Medicine {
  return {
    id: "1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades",
    stock: 100, minimumStock: 20, lot: "L1", expiresAt: "2099-01-01", active: true, ...o,
  };
}

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("MedicineCard", () => {
  it("muestra nombre, presentación y estado disponible", () => {
    render(<MedicineCard medicine={med()} onRegister={() => {}} />);
    expect(screen.getByText("Metformina")).toBeInTheDocument();
    expect(screen.getByText("500 mg · Tableta")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
  });

  it("marca stock bajo cuando iguala o baja del mínimo", () => {
    render(<MedicineCard medicine={med({ stock: 20, minimumStock: 20 })} onRegister={() => {}} />);
    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
  });

  it("muestra 'Vencido' con fecha pasada", () => {
    render(<MedicineCard medicine={med({ expiresAt: "2000-01-01" })} onRegister={() => {}} />);
    expect(screen.getByText("Vencido")).toBeInTheDocument();
  });

  it("muestra 'Vence pronto' dentro de los 30 días", () => {
    render(<MedicineCard medicine={med({ expiresAt: inDays(10) })} onRegister={() => {}} />);
    expect(screen.getByText("Vence pronto")).toBeInTheDocument();
  });

  it("llama onRegister al pulsar el botón", async () => {
    const onRegister = vi.fn();
    render(<MedicineCard medicine={med()} onRegister={onRegister} />);
    await userEvent.click(screen.getByText(/Registrar movimiento/));
    expect(onRegister).toHaveBeenCalledOnce();
  });
});
