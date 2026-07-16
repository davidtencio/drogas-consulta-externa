import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("muestra los cuatro indicadores con sus valores", () => {
    render(<StatsBar total={1234} low={5} expiring={2} recent={8} />);
    expect(screen.getByText("Existencias totales")).toBeInTheDocument();
    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
    expect(screen.getByText("Próximos a vencer")).toBeInTheDocument();
    expect(screen.getByText("Movimientos recientes")).toBeInTheDocument();
    // El total va formateado (separador de miles según locale); normalizamos dígitos.
    expect(
      screen.getByText((_, el) => el?.tagName === "STRONG" && el.textContent?.replace(/\D/g, "") === "1234")
    ).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
