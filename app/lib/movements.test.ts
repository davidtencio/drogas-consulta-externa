import { describe, it, expect } from "vitest";
import {
  filterMovements,
  sortMovements,
  filterAndSortMovements,
  summarizeMovements,
  lastCountByMedicine,
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
  it("filtra por un medicamento concreto (medicineId)", () => {
    const list = [
      mov({ id: "a", medicineId: "m1", medicineName: "Metformina" }),
      mov({ id: "b", medicineId: "m2", medicineName: "Ibuprofeno" }),
      mov({ id: "c", medicineId: "m1", medicineName: "Metformina" }),
    ];
    expect(filterMovements(list, { type: "ALL", text: "", medicineId: "m1" }).map((m) => m.id)).toEqual(["a", "c"]);
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

describe("summarizeMovements", () => {
  it("resume conteos, cantidades y neto", () => {
    // sample: a=IN 10 (Metformina), b=OUT 3 (Amoxicilina), c=OUT 25 (Ibuprofeno)
    const s = summarizeMovements(sample);
    expect(s.count).toBe(3);
    expect(s.inCount).toBe(1);
    expect(s.outCount).toBe(2);
    expect(s.inQuantity).toBe(10);
    expect(s.outQuantity).toBe(28);
    expect(s.net).toBe(-18);
    expect(s.medicineCount).toBe(3);
  });
  it("cuenta medicamentos distintos sin duplicar", () => {
    const list = [
      mov({ id: "a", type: "IN", quantity: 5, medicineName: "Metformina" }),
      mov({ id: "b", type: "OUT", quantity: 2, medicineName: "Metformina" }),
    ];
    expect(summarizeMovements(list).medicineCount).toBe(1);
  });
  it("neto positivo cuando entran más unidades de las que salen", () => {
    const list = [
      mov({ type: "IN", quantity: 50 }),
      mov({ type: "OUT", quantity: 20 }),
    ];
    expect(summarizeMovements(list).net).toBe(30);
  });
  it("trata cantidades no numéricas como 0", () => {
    const list = [mov({ type: "IN", quantity: NaN }), mov({ type: "IN", quantity: 4 })];
    expect(summarizeMovements(list).inQuantity).toBe(4);
  });
  it("con lista vacía devuelve todo en cero", () => {
    expect(summarizeMovements([])).toEqual({
      count: 0,
      inCount: 0,
      outCount: 0,
      countEvents: 0,
      inQuantity: 0,
      outQuantity: 0,
      net: 0,
      medicineCount: 0,
    });
  });
  it("los conteos no afectan el flujo (in/out/neto) pero se cuentan aparte", () => {
    const list = [
      mov({ id: "a", type: "IN", quantity: 10 }),
      mov({ id: "b", type: "OUT", quantity: 4 }),
      mov({ id: "c", type: "COUNT", quantity: 999, medicineName: "Ibuprofeno" }),
    ];
    const s = summarizeMovements(list);
    expect(s.count).toBe(3);
    expect(s.inQuantity).toBe(10);
    expect(s.outQuantity).toBe(4);
    expect(s.net).toBe(6);
    expect(s.countEvents).toBe(1);
    expect(s.medicineCount).toBe(2);
  });
});

describe("lastCountByMedicine", () => {
  it("toma el conteo más reciente por medicamento", () => {
    const list = [
      mov({ id: "1", medicineId: "a", type: "COUNT", createdAt: "2026-07-10T08:00:00.000Z" }),
      mov({ id: "2", medicineId: "a", type: "COUNT", createdAt: "2026-07-16T09:00:00.000Z" }),
      mov({ id: "3", medicineId: "b", type: "COUNT", createdAt: "2026-07-12T09:00:00.000Z" }),
    ];
    const map = lastCountByMedicine(list);
    expect(map.get("a")).toBe("2026-07-16T09:00:00.000Z");
    expect(map.get("b")).toBe("2026-07-12T09:00:00.000Z");
  });
  it("ignora ingresos y egresos (solo cuenta arqueos)", () => {
    const list = [
      mov({ id: "1", medicineId: "a", type: "IN", createdAt: "2026-07-16T09:00:00.000Z" }),
      mov({ id: "2", medicineId: "a", type: "OUT", createdAt: "2026-07-16T10:00:00.000Z" }),
    ];
    expect(lastCountByMedicine(list).has("a")).toBe(false);
  });
  it("ignora conteos sin medicineId", () => {
    const list = [mov({ id: "1", type: "COUNT", createdAt: "2026-07-16T09:00:00.000Z" })];
    expect(lastCountByMedicine(list).size).toBe(0);
  });
});
