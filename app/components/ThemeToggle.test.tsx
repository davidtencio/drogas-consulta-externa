import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("por defecto ofrece cambiar a modo oscuro", async () => {
    render(<ThemeToggle />);
    expect(await screen.findByRole("button", { name: "Cambiar a modo oscuro" })).toBeInTheDocument();
  });

  it("al pulsar aplica data-theme=dark y lo persiste", async () => {
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button", { name: "Cambiar a modo oscuro" });
    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Cambiar a modo claro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("respeta el tema guardado al montar", async () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeToggle />);
    // Ya en oscuro: el botón ofrece volver a claro.
    expect(await screen.findByRole("button", { name: "Cambiar a modo claro" })).toBeInTheDocument();
  });
});
