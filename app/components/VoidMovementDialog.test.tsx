import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoidMovementDialog } from "./VoidMovementDialog";
import type { Movement } from "../lib/inventory";

const movement: Movement = {
  id: "o1", medicineId: "m1", medicineName: "Morfina", type: "OUT", quantity: 3, prescriptionRef: "RX-1",
  pharmacistEmail: "ana@h.cr", createdAt: "2026-07-16T10:00:00.000Z",
};

describe("VoidMovementDialog", () => {
  it("exige motivo suficiente para anular", async () => {
    const onConfirm = vi.fn();
    render(<VoidMovementDialog movement={movement} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    const submit = screen.getByRole("button", { name: "Anular egreso" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Motivo de la anulación"), "Receta duplicada");
    await userEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith("Receta duplicada");
    expect(screen.queryByText(/Hay una toma de inventario posterior/)).not.toBeInTheDocument();
  });

  it("si hay una toma posterior, avisa y exige confirmarla", async () => {
    const onConfirm = vi.fn();
    render(<VoidMovementDialog movement={movement} lastCountAt="2026-07-20T09:00:00.000Z" busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/Hay una toma de inventario posterior/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Motivo de la anulación"), "Receta duplicada");
    const submit = screen.getByRole("button", { name: "Anular egreso" });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/Confirmo que la diferencia de esa toma no se ajustó ya/));
    await userEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith("Receta duplicada");
  });
});
