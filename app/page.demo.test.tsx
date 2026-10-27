import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { registerMovement } = vi.hoisted(() => ({ registerMovement: vi.fn() }));
vi.mock("./firebase", () => ({ auth: {}, db: {} }));
vi.mock("./lib/db", () => ({ registerMovement }));
vi.mock("./lib/demo", async (original) => ({ ...await original<typeof import("./lib/demo")>(), DEMO_MODE: true }));
vi.mock("./hooks/useAuthUser", () => ({ useAuthUser: () => ({ authReady: true, user: { email: "demo@demo.local" } }) }));
vi.mock("./hooks/useOnline", () => ({ useOnline: () => true }));
vi.mock("./hooks/useInventoryData", () => ({ useInventoryData: () => ({
  medicines: [{ id: "demo", name: "Presentación DEMO", strength: "1 mg", form: "Tableta", stock: 10, minimumStock: 2, unit: "unidades", lot: "DEMO", expiresAt: "2099-01-01" }],
  pharmacists: [{ id: "p1", name: "Responsable DEMO", email: "demo@demo.local", license: "CF-DEMO" }],
  movements: [], auditLogs: [], loading: false, pendingWrites: false, retryInventory: vi.fn(),
}) }));
import Page from "./page";

describe("recuperación de un movimiento en la aplicación", () => {
  it("asocia existencias insuficientes a cantidad, conserva el formulario y permite corregirlo", async () => {
    registerMovement.mockRejectedValueOnce(new Error("Existencias insuficientes.")).mockResolvedValueOnce(undefined);
    render(<Page />);
    await userEvent.click(screen.getByRole("button", { name: "Registrar movimiento" }));
    await userEvent.selectOptions(screen.getByLabelText("Medicamento"), "demo");
    await userEvent.type(screen.getByLabelText("Cantidad"), "999");
    await userEvent.selectOptions(screen.getByLabelText("Farmacéutico responsable"), "demo@demo.local");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar movimiento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Existencias insuficientes");
    expect(screen.getByLabelText("Cantidad")).toHaveFocus();
    expect(screen.getByLabelText("Cantidad")).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(screen.getByLabelText("Cantidad"));
    await userEvent.type(screen.getByLabelText("Cantidad"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar movimiento" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(registerMovement).toHaveBeenLastCalledWith(expect.objectContaining({ medicineId: "demo", quantity: 1, type: "OUT" }));
  });
});
