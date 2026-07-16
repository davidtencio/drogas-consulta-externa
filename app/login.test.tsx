import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock del SDK de Firebase Auth: no queremos red ni popups reales en los tests.
const signInWithPopup = vi.fn();
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({}));
// Mock de nuestro módulo de Firebase para no inicializar la app real.
vi.mock("./firebase", () => ({ auth: {}, db: {} }));

import { Login } from "./page";

describe("Login", () => {
  beforeEach(() => {
    signInWithPopup.mockReset();
  });

  it("muestra el botón de acceso con Google", () => {
    render(<Login />);
    expect(
      screen.getByRole("button", { name: /continuar con google/i })
    ).toBeInTheDocument();
  });

  it("inicia sesión con Google al pulsar el botón", async () => {
    signInWithPopup.mockResolvedValueOnce({ user: { email: "a@b.com" } });
    render(<Login />);
    await userEvent.click(
      screen.getByRole("button", { name: /continuar con google/i })
    );
    expect(signInWithPopup).toHaveBeenCalledOnce();
  });

  it("muestra un mensaje de error si el inicio de sesión falla", async () => {
    signInWithPopup.mockRejectedValueOnce({ code: "auth/network-request-failed" });
    render(<Login />);
    await userEvent.click(
      screen.getByRole("button", { name: /continuar con google/i })
    );
    expect(await screen.findByText(/no se pudo iniciar sesión/i)).toBeInTheDocument();
  });

  it("no muestra error si el usuario cierra el popup", async () => {
    signInWithPopup.mockRejectedValueOnce({ code: "auth/popup-closed-by-user" });
    render(<Login />);
    await userEvent.click(
      screen.getByRole("button", { name: /continuar con google/i })
    );
    // Damos oportunidad a que un posible error se renderice.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/no se pudo iniciar sesión/i)).not.toBeInTheDocument();
  });
});
