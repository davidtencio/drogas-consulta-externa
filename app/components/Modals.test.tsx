import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modals } from "./Modals";
import type { Medicine, Pharmacist } from "../lib/inventory";

const med: Medicine = {
  id: "m1", name: "Metformina", strength: "500 mg", form: "Tableta", unit: "unidades",
  stock: 50, minimumStock: 10, lot: "L1", expiresAt: "2099-01-01", active: true,
};
const pharm: Pharmacist = { id: "p1", name: "Ana Rojas", email: "ana@h.cr", license: "CF-1", active: true };

function base(over: Partial<Parameters<typeof Modals>[0]> = {}) {
  return {
    state: { kind: "movement" } as Parameters<typeof Modals>[0]["state"],
    activeMeds: [med], activePharmacists: [pharm],
    busy: false, online: true, onClose: vi.fn(), onSubmit: vi.fn((e) => e.preventDefault()), ...over,
  };
}

describe("Modals", () => {
  it("movimiento: muestra título y selector de responsable", () => {
    render(<Modals {...base()} />);
    expect(screen.getByText("Registrar movimiento")).toBeInTheDocument();
    expect(screen.getByText("Farmacéutico responsable")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ana Rojas — CF-1" })).toBeInTheDocument();
  });

  it("movimiento con preajuste: título de ingreso y medicamento/tipo preseleccionados", () => {
    render(<Modals {...base({ state: { kind: "movement", medicineId: "m1", type: "IN" } })} />);
    expect(screen.getByText("Registrar ingreso")).toBeInTheDocument();
    expect((screen.getByLabelText("Medicamento") as HTMLSelectElement).value).toBe("m1");
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("IN");
    expect(screen.queryByLabelText("Referencia de prescripción")).not.toBeInTheDocument();
  });

  it("muestra la referencia únicamente para egresos", async () => {
    render(<Modals {...base()} />);
    expect(screen.getByLabelText("Referencia de prescripción")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "IN");
    expect(screen.queryByLabelText("Referencia de prescripción")).not.toBeInTheDocument();
  });

  it("movimiento sin farmacéuticos: deshabilita y avisa", () => {
    render(<Modals {...base({ activePharmacists: [] })} />);
    expect(screen.getByText(/Registre un farmacéutico autorizado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar movimiento" })).toBeDisabled();
  });

  it("movimiento sin conexión: deshabilita y avisa", () => {
    render(<Modals {...base({ online: false })} />);
    expect(screen.getByText(/Sin conexión: el registro de movimientos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar movimiento" })).toBeDisabled();
  });

  it("no presenta un fallo de lectura del personal como falta de registros", () => {
    render(<Modals {...base({ activePharmacists: [], personnelMessage: "No se pudo obtener el personal autorizado." })} />);
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo obtener el personal autorizado.");
    expect(screen.queryByText(/Registre un farmacéutico autorizado/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar movimiento" })).toBeDisabled();
  });

  it("medicamento en edición: título 'Editar' y precarga el nombre", () => {
    render(<Modals {...base({ state: { kind: "medicine", editing: med } })} />);
    expect(screen.getByText("Editar medicamento")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Metformina")).toBeInTheDocument();
  });

  it("envía el formulario con la acción correspondiente", async () => {
    const props = base({ state: { kind: "pharmacist", editing: null } });
    render(<Modals {...props} />);
    await userEvent.type(screen.getByLabelText("Nombre completo"), "Luis");
    await userEvent.type(screen.getByLabelText("Correo institucional"), "luis@h.cr");
    await userEvent.type(screen.getByLabelText("Código profesional"), "CF-9");
    await userEvent.click(screen.getByRole("button", { name: "Autorizar usuario" }));
    expect(props.onSubmit).toHaveBeenCalled();
    expect(props.onSubmit.mock.calls[0][1]).toBe("pharmacist");
  });

  it("cierra al pulsar la X", async () => {
    const props = base();
    render(<Modals {...props} />);
    await userEvent.click(screen.getByLabelText("Cerrar"));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("asocia el error al campo y mueve el foco", () => {
    render(<Modals {...base({ error: "Cantidad inválida.", errorField: "quantity" })} />);
    const quantity = screen.getByLabelText("Cantidad");
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveAttribute("aria-describedby", "modal-error");
    expect(quantity).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Cantidad inválida.");
  });

  it("mantiene los datos de los lotes restantes al quitar otro y envía cada fila", async () => {
    const submitted = vi.fn();
    render(<Modals {...base({ state: { kind: "movement", medicineId: "m1", type: "IN" }, onSubmit: (event) => { event.preventDefault(); submitted(new FormData(event.currentTarget)); } })} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar otro lote" }));
    await userEvent.type(screen.getAllByLabelText("Lote")[1], "LOTE-B");
    await userEvent.type(screen.getAllByLabelText("Expira")[1], "2099-01-01");
    await userEvent.type(screen.getAllByLabelText("Cantidad")[1], "4");
    await userEvent.click(screen.getByRole("button", { name: "Quitar lote 1" }));
    expect(screen.getByLabelText("Lote")).toHaveValue("LOTE-B");
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "ana@h.cr");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar movimiento" }));
    expect(submitted).toHaveBeenCalledOnce();
    const form = submitted.mock.calls[0][0] as FormData;
    expect(form.getAll("lotNumber")).toEqual(["LOTE-B"]);
    expect(form.getAll("lotQuantity")).toEqual(["4"]);
  });

  it("cancelar cierra sin enviar el formulario", async () => {
    const props = base();
    render(<Modals {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
