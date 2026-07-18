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
  const view = () => {};
  it("muestra nombre, presentación y estado disponible", () => {
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("Metformina")).toBeInTheDocument();
    expect(screen.getByText("500 mg · Tableta")).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
  });

  it("marca stock bajo cuando iguala o baja del mínimo", () => {
    render(<MedicineCard medicine={med({ stock: 20, minimumStock: 20 })} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
  });

  it("muestra el código del medicamento y un guion cuando no existe", () => {
    const { rerender } = render(<MedicineCard medicine={med({ code: "123-45-6789" })} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("123-45-6789")).toBeInTheDocument();
    rerender(<MedicineCard medicine={med({ code: undefined })} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("muestra 'Vencido' con fecha pasada", () => {
    render(<MedicineCard medicine={med({ expiresAt: "2000-01-01" })} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("Vencido")).toBeInTheDocument();
  });

  it("muestra 'Vence pronto' dentro de los 30 días", () => {
    render(<MedicineCard medicine={med({ expiresAt: inDays(10) })} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("Vence pronto")).toBeInTheDocument();
  });

  it("llama onMovement con IN o OUT según el botón", async () => {
    const onMovement = vi.fn();
    render(<MedicineCard medicine={med()} onMovement={onMovement} onCount={() => {}} onViewMovements={view} />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }));
    expect(onMovement).toHaveBeenLastCalledWith("IN");
    await userEvent.click(screen.getByRole("button", { name: /Registrar egreso/ }));
    expect(onMovement).toHaveBeenLastCalledWith("OUT");
  });

  it("llama onCount al pulsar Conteo", async () => {
    const onCount = vi.fn();
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={onCount} onViewMovements={view} />);
    await userEvent.click(screen.getByRole("button", { name: /Confirmar conteo/ }));
    expect(onCount).toHaveBeenCalledOnce();
  });

  it("indica cuando no existe una toma certificada", () => {
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    expect(screen.getByText("Sin toma certificada")).toBeInTheDocument();
  });

  it("muestra el check y abre los datos de la certificación", async () => {
    render(<MedicineCard medicine={med()} certification={{ createdAt: "2026-07-16T10:00:00.000Z", pharmacistName: "Ana Rojas" }} onMovement={() => {}} onCount={() => {}} onViewMovements={view} />);
    const check = screen.getByRole("button", { name: "Ver certificación de Metformina" });
    expect(check).toHaveAttribute("title", expect.stringContaining("Farmacéutico: Ana Rojas"));
    await userEvent.click(check);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ana Rojas")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("abre los movimientos del medicamento al pulsar la tarjeta", async () => {
    const onViewMovements = vi.fn();
    render(<MedicineCard medicine={med()} onMovement={() => {}} onCount={() => {}} onViewMovements={onViewMovements} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver movimientos de Metformina 500 mg" }));
    expect(onViewMovements).toHaveBeenCalledOnce();
  });
});
