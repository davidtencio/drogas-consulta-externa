import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  it("muestra los cuatro indicadores con sus valores", () => {
    render(<StatsBar summary={{ total: 1234, low: 5, expired: 2, soon: 8, unknown: 0 }} active="all" onSelect={() => {}} />);
    expect(screen.getByText("Medicamentos en catálogo")).toBeInTheDocument();
    expect(screen.getByText("Con stock bajo")).toBeInTheDocument();
    expect(screen.getByText("Con lotes vencidos")).toBeInTheDocument();
    expect(screen.getByText("Con lotes por vencer")).toBeInTheDocument();
    // El total va formateado (separador de miles según locale); normalizamos dígitos.
    expect(
      screen.getByText((_, el) => el?.tagName === "STRONG" && el.textContent?.replace(/\D/g, "") === "1234")
    ).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
