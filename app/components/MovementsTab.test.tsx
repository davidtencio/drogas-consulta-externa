import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// La exportación usa Firestore; lo mockeamos para que el render no toque la red.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
}));
vi.mock("../firebase", () => ({ db: {} }));

import { MovementsTab } from "./MovementsTab";
import type { Medicine, Movement } from "../lib/inventory";

const medMed = (o: Partial<Medicine>): Medicine => ({
  id: "1", name: "Med", strength: "1", form: "Tableta", unit: "u", stock: 0, minimumStock: 0, lot: "", expiresAt: "", active: true, ...o,
});

function mov(o: Partial<Movement> = {}): Movement {
  return {
    id: "m1", type: "OUT", quantity: 5, medicineName: "Metformina",
    prescriptionRef: "RX-1", pharmacistEmail: "ana@h.cr",
    createdAt: "2026-07-16T10:00:00.000Z", ...o,
  };
}

const names = new Map([["ana@h.cr", "Ana Rojas"], ["luis@h.cr", "Luis Mora"]]);

const sample: Movement[] = [
  mov({ id: "a", type: "IN", medicineName: "Amoxicilina", pharmacistEmail: "ana@h.cr", createdAt: "2026-07-10T08:00:00.000Z" }),
  mov({ id: "b", type: "OUT", medicineName: "Ibuprofeno", pharmacistEmail: "luis@h.cr", createdAt: "2026-07-15T09:00:00.000Z" }),
];

describe("MovementsTab", () => {
  const noop = () => {};

  it("muestra el nombre del responsable, no el correo", () => {
    render(<MovementsTab movements={sample} medicines={[]} pharmacistNames={names} onNotice={noop} />);
    expect(screen.getByText("Ana Rojas")).toBeInTheDocument();
    expect(screen.getByText("Luis Mora")).toBeInTheDocument();
    expect(screen.queryByText("ana@h.cr")).not.toBeInTheDocument();
  });

  it("filtra por tipo", async () => {
    render(<MovementsTab movements={sample} medicines={[]} pharmacistNames={names} onNotice={noop} />);
    const body = screen.getByRole("table").querySelector("tbody")!;
    expect(within(body).getByText("Amoxicilina")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por tipo"), "OUT");
    expect(within(body).queryByText("Amoxicilina")).not.toBeInTheDocument();
    expect(within(body).getByText("Ibuprofeno")).toBeInTheDocument();
  });

  it("filtra por texto de medicamento", async () => {
    render(<MovementsTab movements={sample} medicines={[]} pharmacistNames={names} onNotice={noop} />);
    await userEvent.type(screen.getByLabelText("Buscar movimientos"), "ibupro");
    const body = screen.getByRole("table").querySelector("tbody")!;
    expect(within(body).queryByText("Amoxicilina")).not.toBeInTheDocument();
    expect(within(body).getByText("Ibuprofeno")).toBeInTheDocument();
  });

  it("muestra mensaje cuando no hay coincidencias", async () => {
    render(<MovementsTab movements={sample} medicines={[]} pharmacistNames={names} onNotice={noop} />);
    await userEvent.type(screen.getByLabelText("Buscar movimientos"), "zzz");
    expect(screen.getByText("Ningún movimiento coincide con los filtros.")).toBeInTheDocument();
  });

  it("indica vacío cuando no hay movimientos", () => {
    render(<MovementsTab movements={[]} medicines={[]} pharmacistNames={names} onNotice={noop} />);
    expect(screen.getByText("Aún no hay movimientos registrados.")).toBeInTheDocument();
  });

  it("muestra esqueletos mientras carga, no el mensaje de vacío", () => {
    const { container } = render(<MovementsTab movements={[]} medicines={[]} pharmacistNames={names} onNotice={noop} loading />);
    expect(container.querySelectorAll("tr.skeleton-row").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aún no hay movimientos registrados.")).not.toBeInTheDocument();
  });

  it("filtra por medicamento con el selector", async () => {
    const movs = [
      mov({ id: "a", medicineId: "m1", medicineName: "Amoxicilina" }),
      mov({ id: "b", medicineId: "m2", medicineName: "Ibuprofeno" }),
    ];
    const meds = [medMed({ id: "m1", name: "Amoxicilina" }), medMed({ id: "m2", name: "Ibuprofeno" })];
    render(<MovementsTab movements={movs} medicines={meds} pharmacistNames={names} onNotice={noop} />);
    await userEvent.selectOptions(screen.getByLabelText("Filtrar por medicamento"), "m1");
    const body = screen.getByRole("table").querySelector("tbody")!;
    expect(within(body).getByText("Amoxicilina")).toBeInTheDocument();
    expect(within(body).queryByText("Ibuprofeno")).not.toBeInTheDocument();
  });
});
