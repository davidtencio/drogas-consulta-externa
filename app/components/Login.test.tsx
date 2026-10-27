import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ GoogleAuthProvider: class {}, signInWithPopup: signIn }));
import { Login } from "./Login";

beforeEach(() => signIn.mockReset());
describe("acceso", () => {
  it("conserva Google, informa el fallo y permite reintentar", async () => {
    signIn.mockRejectedValueOnce({ code: "auth/network-request-failed" }).mockResolvedValueOnce({});
    render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar sesión");
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("cancelar la ventana de Google no muestra un error y no detecta infracciones axe", async () => {
    signIn.mockRejectedValueOnce({ code: "auth/popup-closed-by-user" });
    const { container } = render(<Login />);
    await userEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
