import { describe, it, expect } from "vitest";
import {
  activeMedicines,
  filterMedicines,
  isActive,
  isLowStock,
  isValidQuantity,
  lowStockCount,
  nextStock,
  sortByName,
  stockPercent,
  totalStock,
  type Medicine,
} from "./inventory";

// Fábrica de medicamentos con valores por defecto sensatos para cada test.
function med(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: "1",
    name: "Metformina",
    strength: "500 mg",
    form: "Tableta",
    unit: "unidades",
    stock: 100,
    minimumStock: 20,
    lot: "L1",
    expiresAt: "2027-01-01",
    active: true,
    ...overrides,
  };
}

describe("isActive", () => {
  it("es activo por defecto (active indefinido)", () => {
    expect(isActive({})).toBe(true);
  });
  it("es activo cuando active es true", () => {
    expect(isActive({ active: true })).toBe(true);
  });
  it("solo es inactivo cuando active es exactamente false", () => {
    expect(isActive({ active: false })).toBe(false);
  });
});

describe("sortByName", () => {
  it("ordena por nombre respetando acentos del español", () => {
    const items = [{ name: "Ácido" }, { name: "Zinc" }, { name: "Betametasona" }];
    expect(sortByName(items).map((i) => i.name)).toEqual([
      "Ácido",
      "Betametasona",
      "Zinc",
    ]);
  });
  it("no muta el arreglo original", () => {
    const items = [{ name: "B" }, { name: "A" }];
    const copy = [...items];
    sortByName(items);
    expect(items).toEqual(copy);
  });
});

describe("activeMedicines", () => {
  it("excluye los medicamentos dados de baja", () => {
    const list = [med({ id: "a" }), med({ id: "b", active: false }), med({ id: "c" })];
    expect(activeMedicines(list).map((m) => m.id)).toEqual(["a", "c"]);
  });
});

describe("filterMedicines", () => {
  const list = [
    med({ id: "a", name: "Metformina", strength: "500 mg" }),
    med({ id: "b", name: "Amoxicilina", strength: "875 mg" }),
    med({ id: "c", name: "Metoprolol", strength: "50 mg" }),
  ];
  it("devuelve todo con búsqueda vacía o de espacios", () => {
    expect(filterMedicines(list, "")).toHaveLength(3);
    expect(filterMedicines(list, "   ")).toHaveLength(3);
  });
  it("coincide por nombre sin distinguir mayúsculas", () => {
    expect(filterMedicines(list, "met").map((m) => m.id)).toEqual(["a", "c"]);
  });
  it("coincide por concentración", () => {
    expect(filterMedicines(list, "875").map((m) => m.id)).toEqual(["b"]);
  });
  it("devuelve vacío si nada coincide", () => {
    expect(filterMedicines(list, "zzz")).toEqual([]);
  });
});

describe("totalStock", () => {
  it("suma las existencias", () => {
    expect(totalStock([med({ stock: 100 }), med({ stock: 25 })])).toBe(125);
  });
  it("trata valores no numéricos como 0", () => {
    expect(totalStock([med({ stock: NaN }), med({ stock: 10 })])).toBe(10);
  });
  it("es 0 para lista vacía", () => {
    expect(totalStock([])).toBe(0);
  });
});

describe("isLowStock / lowStockCount", () => {
  it("está bajo cuando iguala el mínimo (límite inclusivo)", () => {
    expect(isLowStock({ stock: 20, minimumStock: 20 })).toBe(true);
  });
  it("está bajo cuando baja del mínimo", () => {
    expect(isLowStock({ stock: 5, minimumStock: 20 })).toBe(true);
  });
  it("no está bajo por encima del mínimo", () => {
    expect(isLowStock({ stock: 21, minimumStock: 20 })).toBe(false);
  });
  it("cuenta los que están en stock bajo", () => {
    const list = [
      med({ stock: 5, minimumStock: 20 }),
      med({ stock: 100, minimumStock: 20 }),
      med({ stock: 20, minimumStock: 20 }),
    ];
    expect(lowStockCount(list)).toBe(2);
  });
});

describe("stockPercent", () => {
  it("es 50% cuando el stock iguala el mínimo", () => {
    expect(stockPercent({ stock: 20, minimumStock: 20 })).toBe(50);
  });
  it("se limita a 100%", () => {
    expect(stockPercent({ stock: 1000, minimumStock: 20 })).toBe(100);
  });
  it("es 0% sin existencias", () => {
    expect(stockPercent({ stock: 0, minimumStock: 20 })).toBe(0);
  });
  it("evita dividir entre cero cuando el mínimo es 0", () => {
    expect(stockPercent({ stock: 0, minimumStock: 0 })).toBe(0);
    expect(stockPercent({ stock: 5, minimumStock: 0 })).toBe(100);
  });
});

describe("isValidQuantity", () => {
  it("acepta enteros positivos", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(42)).toBe(true);
  });
  it("rechaza cero y negativos", () => {
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-3)).toBe(false);
  });
  it("rechaza decimales y NaN", () => {
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
  });
});

describe("nextStock", () => {
  it("suma en un ingreso", () => {
    expect(nextStock(100, "IN", 25)).toBe(125);
  });
  it("resta en un egreso", () => {
    expect(nextStock(100, "OUT", 30)).toBe(70);
  });
  it("permite llegar exactamente a cero", () => {
    expect(nextStock(30, "OUT", 30)).toBe(0);
  });
  it("lanza error si el egreso deja existencias negativas", () => {
    expect(() => nextStock(10, "OUT", 11)).toThrow("Existencias insuficientes.");
  });
  it("trata un stock actual no numérico como 0", () => {
    expect(nextStock(NaN, "IN", 5)).toBe(5);
  });
});
