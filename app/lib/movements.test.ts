import { describe, it, expect } from "vitest";
import {
  filterMovements,
  sortMovements,
  filterAndSortMovements,
} from "./movements";
import type { Movement } from "./inventory";

function mov(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "m1",
    type: "OUT",
    quantity: 5,
    medicineName: "Metformina",
    prescriptionRef: "RX-1",
    pharmacistEmail: "farma@hospital.cr",
    createdAt: "2026-07-16T10:00:00.000Z",
    ...overrides,
  };
}

const sample: Movement[] = [
  mov({ id: "a", type: "IN", quantity: 10, medicineName: "Metformina", prescriptionRef: "RX-100", createdAt: "2026-07-10T08:00:00.000Z" }),
  mov({ id: "b", type: "OUT", quantity: 3, medicineName: "Amoxicilina", prescriptionRef: "RX-200", createdAt: "2026-07-15T09:00:00.000Z" }),
  mov({ id: "c", type: "OUT", quantity: 25, medicineName: "Ibuprofeno", prescriptionRef: "RX-300", createdAt: "2026-07-12T11:00:00.000Z" }),
];

describe("filterMovements", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterMovements(sample, { type: "ALL", text: "" })).toHaveLength(3);
  });
  it("filtra por tipo IN", () => {
    expect(filterMovements(sample, { type: "IN", text: "" }).map((m) => m.id)).toEqual(["a"]);
  });
  it("filtra por tipo OUT", () => {
    expect(filterMovements(sample, { type: "OUT", text: "" }).map((m) => m.id)).toEqual(["b", "c"]);
  });
  it("filtra por nombre de medicamento sin distinguir mayúsculas", () => {
    expect(filterMovements(sample, { type: "ALL", text: "amox" }).map((m) => m.id)).toEqual(["b"]);
  });
  it("filtra por referencia de prescripción", () => {
    expect(filterMovements(sample, { type: "ALL", text: "RX-300" }).map((m) => m.id)).toEqual(["c"]);
  });
  it("combina tipo y texto", () => {
    expect(filterMovements(sample, { type: "OUT", text: "ibupro" }).map((m) => m.id)).toEqual(["c"]);
  });
  it("ignora espacios alrededor del texto", () => {
    expect(filterMovements(sample, { type: "ALL", text: "  metformina  " }).map((m) => m.id)).toEqual(["a"]);
  });
  it("devuelve vacío si nada coincide", () => {
    expect(filterMovements(sample, { type: "IN", text: "ibupro" })).toEqual([]);
  });
  it("filtra desde una fecha (inclusiva)", () => {
    expect(filterMovements(sample, { type: "ALL", text: "", from: "2026-07-12" }).map((m) => m.id)).toEqual(["b", "c"]);
  });
  it("filtra hasta una fecha (inclusiva)", () => {
    expect(filterMovements(sample, { type: "ALL", text: "", to: "2026-07-12" }).map((m) => m.id)).toEqual(["a", "c"]);
  });
  it("filtra por rango cerrado", () => {
    expect(filterMovements(sample, { type: "ALL", text: "", from: "2026-07-11", to: "2026-07-14" }).map((m) => m.id)).toEqual(["c"]);
  });
  it("incluye un movimiento cuya fecha coincide exactamente con el límite", () => {
    expect(filterMovements(sample, { type: "ALL", text: "", from: "2026-07-15", to: "2026-07-15" }).map((m) => m.id)).toEqual(["b"]);
  });
  it("trata cadenas de fecha vacías como sin límite", () => {
    expect(filterMovements(sample, { type: "ALL", text: "", from: "", to: "" })).toHaveLength(3);
  });
  it("combina rango de fechas con tipo", () => {
    expect(filterMovements(sample, { type: "OUT", text: "", from: "2026-07-11" }).map((m) => m.id)).toEqual(["b", "c"]);
  });
});

describe("sortMovements", () => {
  it("por fecha descendente (reciente primero) por defecto", () => {
    expect(sortMovements(sample, "date-desc").map((m) => m.id)).toEqual(["b", "c", "a"]);
  });
  it("por fecha ascendente", () => {
    expect(sortMovements(sample, "date-asc").map((m) => m.id)).toEqual(["a", "c", "b"]);
  });
  it("por cantidad descendente", () => {
    expect(sortMovements(sample, "qty-desc").map((m) => m.id)).toEqual(["c", "a", "b"]);
  });
  it("por cantidad ascendente", () => {
    expect(sortMovements(sample, "qty-asc").map((m) => m.id)).toEqual(["b", "a", "c"]);
  });
  it("no muta el arreglo original", () => {
    const copy = [...sample];
    sortMovements(sample, "qty-asc");
    expect(sample).toEqual(copy);
  });
});

describe("filterAndSortMovements", () => {
  it("filtra y luego ordena", () => {
    const result = filterAndSortMovements(sample, { type: "OUT", text: "" }, "qty-desc");
    expect(result.map((m) => m.id)).toEqual(["c", "b"]);
  });
});
