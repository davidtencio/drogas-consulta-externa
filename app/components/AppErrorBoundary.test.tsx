import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "./AppErrorBoundary";

vi.mock("../lib/db", () => ({ recordOperationalEvent: vi.fn() }));

function Broken(): React.ReactNode {
  throw new Error("fallo de prueba");
}

describe("AppErrorBoundary", () => {
  it("ofrece una recuperación comprensible ante un fallo inesperado", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta pantalla");
    expect(screen.getByRole("button", { name: "Recargar aplicación" })).toBeInTheDocument();
  });
});
