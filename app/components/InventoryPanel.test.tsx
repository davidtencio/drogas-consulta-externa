import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { Medicine } from "../lib/inventory";
import { InventoryPanel } from "./InventoryPanel";

const medicine: Medicine = { id: "a", name: "Clonazepam", strength: "2 mg", form: "Tableta", unit: "tabletas", stock: 20, minimumStock: 20, lot: "L1", code: "123-45-6789", expiresAt: "2099-01-01" };
const props = () => ({ medicines: [medicine], certifications: new Map(), searchRef: createRef<HTMLInputElement>(), loading: false, error: null, onRetry: vi.fn(), onMovement: vi.fn(), onCount: vi.fn(), onViewMovements: vi.fn(), onExport: vi.fn() });

describe("inventario conectado", () => {
  it("mantiene cantidad, unidad y nivel inclusivo en la tabla y filtra por código", async () => {
    render(<InventoryPanel {...props()}/>);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("20")).toBeInTheDocument();
    expect(table.getByText("En el mínimo")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "123-45");
    expect(table.getByText("Clonazepam")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filtrar inventario"), "expired");
    expect(screen.getByText("No encontramos medicamentos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda y filtros" }));
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
  it("abre el detalle heredado y conserva los accesos de egreso y trazabilidad", async () => {
    const callbacks = props();
    render(<InventoryPanel {...callbacks}/>);
    await userEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver detalle de Clonazepam 2 mg" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/Aún no hay un desglose/)).toBeInTheDocument();
    expect(dialog.getByText("L1")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Egreso" }));
    expect(callbacks.onMovement).toHaveBeenCalledWith("a", "OUT");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("exporta exclusivamente la vista filtrada", async () => {
    const callbacks = props();
    render(<InventoryPanel {...callbacks} medicines={[medicine, { ...medicine, id: "b", name: "Morfina" }]}/>);
    await userEvent.type(screen.getByRole("searchbox"), "clonazepam");
    await userEvent.click(screen.getByRole("button", { name: "Exportar vista CSV" }));
    expect(callbacks.onExport).toHaveBeenCalledWith([medicine]);
  });
  it("distingue error, carga y catálogo vacío y permite reintentar", async () => {
    const callbacks = props();
    const { rerender } = render(<InventoryPanel {...callbacks} loading/>);
    expect(screen.getByText("Cargando inventario…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    rerender(<InventoryPanel {...callbacks} error="Consulta rechazada"/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Consulta rechazada");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar consulta" }));
    expect(callbacks.onRetry).toHaveBeenCalledOnce();
    rerender(<InventoryPanel {...callbacks} medicines={[]}/>);
    expect(screen.getByText("Sin medicamentos activos")).toBeInTheDocument();
  });
  it("no introduce infracciones automáticas de accesibilidad en tabla ni detalle", async () => {
    const { container } = render(<InventoryPanel {...props()}/>);
    expect((await axe(container)).violations).toHaveLength(0);
    await userEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver detalle de Clonazepam 2 mg" }));
    expect((await axe(screen.getByRole("dialog"))).violations).toHaveLength(0);
  });
});
