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
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Metformina")).toBeInTheDocument();
    expect(screen.getByText("500 mg · Tableta")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
  });

  it("marca stock bajo cuando iguala o baja del mínimo", () => {
    render(<MedicineCard medicine={med({ stock: 20, minimumStock: 20 })} onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
  });

  it("muestra 'Vencido' con fecha pasada", () => {
    render(<MedicineCard medicine={med({ expiresAt: "2000-01-01" })} onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Vencido")).toBeInTheDocument();
  });

  it("muestra 'Vence pronto' dentro de los 30 días", () => {
    render(<MedicineCard medicine={med({ expiresAt: inDays(10) })} onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Vence pronto")).toBeInTheDocument();
  });

  it("llama onMovement con IN o OUT según el botón", async () => {
    const onMovement = vi.fn();
    render(<MedicineCard medicine={med()} onMovement={onMovement} onCount={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }));
    expect(onMovement).toHaveBeenLastCalledWith("IN");
    await userEvent.click(screen.getByRole("button", { name: /Registrar egreso/ }));
    expect(onMovement).toHaveBeenLastCalledWith("OUT");
  });

  it("llama onCount al pulsar Conteo", async () => {
    const onCount = vi.fn();
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={onCount} />);
    await userEvent.click(screen.getByRole("button", { name: /Confirmar conteo/ }));
    expect(onCount).toHaveBeenCalledOnce();
  });

  it("muestra 'Sin arqueos' cuando no hay último arqueo", () => {
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Sin arqueos")).toBeInTheDocument();
  });

  it("muestra la fecha del último arqueo cuando existe", () => {
    render(<MedicineCard medicine={med()} lastCount="2026-07-16T10:00:00.000Z" onMovement={() => {}} onCount={() => {}} />);
    expect(screen.getByText("Últ. arqueo")).toBeInTheDocument();
    // La fecha se formatea con día/mes/año (es-CR); verificamos el año.
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
