import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { Medicine, Movement } from "../lib/inventory";
import { AnalyticsTab } from "./AnalyticsTab";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const medicines = [
  { id: "morf", name: "Morfina", strength: "10 mg/mL", form: "Ampolla", unit: "ampollas", stock: 5, minimumStock: 1, lot: "L", expiresAt: "2099-01-01" },
  { id: "clon", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "unidades", stock: 5, minimumStock: 1, lot: "L", expiresAt: "2099-01-01" },
] as Medicine[];
const base = { prescriptionRef: "RX", pharmacistEmail: "resp@x.cr", createdAt: daysAgo(200) };
const movements: Movement[] = [
  { ...base, id: "1", type: "OUT", medicineId: "morf", medicineName: "Morfina", quantity: 2, pharmacistEmail: "ana@x.cr", voidedAt: daysAgo(2), voidedByEmail: "sesion@x.cr", voidReason: "Duplicado" },
  { ...base, id: "2", type: "OUT", medicineId: "morf", medicineName: "Morfina", quantity: 1, pharmacistEmail: "ana@x.cr", voidedAt: daysAgo(5), voidedByEmail: "sesion@x.cr", voidReason: "Duplicado" },
  { ...base, id: "3", type: "OUT", medicineId: "clon", medicineName: "Clonazepam", quantity: 30, pharmacistEmail: "beto@x.cr", voidedAt: daysAgo(150), voidedByEmail: "sesion@x.cr", voidReason: "Paciente equivocado" },
  { ...base, id: "4", type: "IN", medicineId: "clon", medicineName: "Clonazepam", quantity: 100, updatedAt: daysAgo(1), editHistory: [{ editedAt: daysAgo(1), editedByEmail: "sesion@x.cr", previous: { type: "IN", quantity: 10, medicineName: "Clonazepam", prescriptionRef: "RX", pharmacistEmail: "beto@x.cr" } }] },
];
const names = new Map([["ana@x.cr", "Ana Mora"], ["beto@x.cr", "Beto Solís"]]);

describe("AnalyticsTab", () => {
  it("muestra el medicamento más anulado y quién más anula en el período", async () => {
    const { container } = render(<AnalyticsTab movements={movements} medicines={medicines} pharmacistNames={names} />);
    const medTable = within(screen.getByRole("region", { name: "Medicamentos más anulados" }));
    const medRows = medTable.getAllByRole("row").slice(1);
    expect(medRows).toHaveLength(1); // Clonazepam quedó fuera de los últimos 90 días
    expect(medRows[0]).toHaveTextContent("Morfina 10 mg/mL");
    expect(medRows[0]).toHaveTextContent("3 ampollas");

    const phRows = within(screen.getByRole("region", { name: "Farmacéuticos que más anulan" })).getAllByRole("row").slice(1);
    expect(phRows[0]).toHaveTextContent("Ana Mora");
    expect(phRows[1]).toHaveTextContent("Beto Solís");
    expect(screen.queryByText("sesion@x.cr")).not.toBeInTheDocument();
    expect(screen.getByText(/Farmacéutico con más anulaciones y correcciones/)).toHaveTextContent("Ana Mora (2 egresos anulados y 0 ingresos corregidos)");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("al ampliar el período incluye anulaciones antiguas", async () => {
    render(<AnalyticsTab movements={movements} medicines={medicines} pharmacistNames={names} />);
    await userEvent.selectOptions(screen.getByLabelText("Período de análisis"), "all");
    const phRows = within(screen.getByRole("region", { name: "Farmacéuticos que más anulan" })).getAllByRole("row").slice(1);
    expect(phRows[0]).toHaveTextContent("Ana Mora");
    expect(phRows[1]).toHaveTextContent("Beto Solís");
    expect(phRows[1]).toHaveTextContent(/1\s*1\s*2/);
    expect(within(screen.getByRole("region", { name: "Medicamentos más anulados" })).getAllByRole("row")).toHaveLength(3);
  });

  it("informa cuando no hay anulaciones y muestra errores con reintento", () => {
    const { rerender } = render(<AnalyticsTab movements={[]} medicines={medicines} pharmacistNames={names} />);
    expect(screen.getByText("No hay egresos anulados en el período.")).toBeInTheDocument();
    rerender(<AnalyticsTab movements={[]} medicines={medicines} pharmacistNames={names} error="Sin conexión" onRetry={() => undefined} />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Sin conexión");
    expect(screen.getAllByRole("button", { name: "Reintentar" })).toHaveLength(2);
  });
});
