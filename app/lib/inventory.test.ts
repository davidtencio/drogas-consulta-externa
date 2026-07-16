import { describe, it, expect } from "vitest";
import {
  activeMedicines,
  daysUntilExpiry,
  displayPharmacist,
  expiringCount,
  expirySummary,
  expiryStatus,
  pharmacistNameByEmail,
  filterMedicines,
  isActive,
  isLowStock,
  isValidCount,
  isValidQuantity,
  lowStockCount,
  nextStock,
  prepareCount,
  prepareMovement,
  sortByName,
  stockPercent,
  totalStock,
  type Medicine,
  type MovementInput,
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

describe("prepareMovement", () => {
  // Entrada base para el registro de un movimiento; se sobreescribe por test.
  function input(overrides: Partial<MovementInput> = {}): MovementInput {
    return {
      medicineId: "med-1",
      type: "OUT",
      quantity: 5,
      prescriptionRef: "RX-2026-00481",
      pharmacistEmail: "farma@hospital.cr",
      createdAt: "2026-07-16T10:00:00.000Z",
      ...overrides,
    };
  }

  it("registra un egreso: descuenta stock y arma la bitácora", () => {
    const result = prepareMovement(
      { name: "Metformina", stock: 100 },
      input({ type: "OUT", quantity: 30 })
    );
    expect(result.nextStock).toBe(70);
    expect(result.record).toEqual({
      medicineId: "med-1",
      medicineName: "Metformina",
      type: "OUT",
      quantity: 30,
      prescriptionRef: "RX-2026-00481",
      pharmacistEmail: "farma@hospital.cr",
      createdAt: "2026-07-16T10:00:00.000Z",
    });
  });

  it("registra un ingreso sumando al stock", () => {
    const result = prepareMovement(
      { name: "Amoxicilina", stock: 40 },
      input({ type: "IN", quantity: 60 })
    );
    expect(result.nextStock).toBe(100);
    expect(result.record.type).toBe("IN");
    expect(result.record.medicineName).toBe("Amoxicilina");
  });

  it("toma el nombre del medicamento leído, no de la entrada", () => {
    const result = prepareMovement(
      { name: "Nombre Real", stock: 10 },
      input({ type: "IN", quantity: 1 })
    );
    expect(result.record.medicineName).toBe("Nombre Real");
  });

  it("permite un egreso que deja el stock exactamente en cero", () => {
    const result = prepareMovement(
      { name: "Ibuprofeno", stock: 5 },
      input({ type: "OUT", quantity: 5 })
    );
    expect(result.nextStock).toBe(0);
  });

  it("rechaza un egreso mayor a las existencias", () => {
    expect(() =>
      prepareMovement({ name: "X", stock: 3 }, input({ type: "OUT", quantity: 4 }))
    ).toThrow("Existencias insuficientes.");
  });

  it("rechaza cantidades no válidas (cero, negativas, decimales)", () => {
    const med = { name: "X", stock: 100 };
    expect(() => prepareMovement(med, input({ quantity: 0 }))).toThrow("Cantidad inválida.");
    expect(() => prepareMovement(med, input({ quantity: -2 }))).toThrow("Cantidad inválida.");
    expect(() => prepareMovement(med, input({ quantity: 1.5 }))).toThrow("Cantidad inválida.");
  });

  it("conserva una referencia de prescripción vacía tal cual", () => {
    const result = prepareMovement(
      { name: "X", stock: 10 },
      input({ type: "IN", quantity: 1, prescriptionRef: "" })
    );
    expect(result.record.prescriptionRef).toBe("");
  });
});

describe("isValidCount", () => {
  it("acepta enteros de 0 o más", () => {
    expect(isValidCount(0)).toBe(true);
    expect(isValidCount(37)).toBe(true);
  });
  it("rechaza negativos, decimales y NaN", () => {
    expect(isValidCount(-1)).toBe(false);
    expect(isValidCount(2.5)).toBe(false);
    expect(isValidCount(NaN)).toBe(false);
  });
});

describe("prepareCount", () => {
  const base = { medicineId: "med-1", note: "", pharmacistEmail: "ana@h.cr", createdAt: "2026-07-16T10:00:00.000Z" };

  it("registra el conteo con sistema, físico y diferencia (sin ajustar stock)", () => {
    const rec = prepareCount({ name: "Metformina", stock: 100 }, { ...base, countedQuantity: 95 });
    expect(rec.type).toBe("COUNT");
    expect(rec.medicineName).toBe("Metformina");
    expect(rec.quantity).toBe(95);        // físico
    expect(rec.systemQuantity).toBe(100);  // sistema al momento
    expect(rec.difference).toBe(-5);       // faltante
  });
  it("diferencia positiva cuando el físico supera al sistema", () => {
    const rec = prepareCount({ name: "X", stock: 10 }, { ...base, countedQuantity: 12 });
    expect(rec.difference).toBe(2);
  });
  it("permite contar 0 (existencia agotada)", () => {
    const rec = prepareCount({ name: "X", stock: 4 }, { ...base, countedQuantity: 0 });
    expect(rec.quantity).toBe(0);
    expect(rec.difference).toBe(-4);
  });
  it("conserva la nota de justificación", () => {
    const rec = prepareCount({ name: "X", stock: 5 }, { ...base, countedQuantity: 5, note: "arqueo diario" });
    expect(rec.note).toBe("arqueo diario");
  });
  it("rechaza una cantidad contada inválida", () => {
    expect(() => prepareCount({ name: "X", stock: 5 }, { ...base, countedQuantity: -1 })).toThrow(/entero/);
  });
});

describe("daysUntilExpiry", () => {
  // Punto de referencia fijo para pruebas deterministas: 15/07/2026 08:00.
  const now = new Date("2026-07-15T08:00:00");

  it("devuelve null si no hay fecha", () => {
    expect(daysUntilExpiry("", now)).toBeNull();
  });
  it("devuelve null si la fecha es inválida", () => {
    expect(daysUntilExpiry("no-es-fecha", now)).toBeNull();
  });
  it("cuenta días positivos hacia el futuro", () => {
    expect(daysUntilExpiry("2026-07-25", now)).toBe(10);
  });
  it("es negativo si la fecha ya pasó", () => {
    expect(daysUntilExpiry("2026-07-05", now)).toBe(-10);
  });
  it("es 0 si vence hoy (sin importar la hora actual)", () => {
    expect(daysUntilExpiry("2026-07-15", now)).toBe(0);
  });
});

describe("expiryStatus", () => {
  const now = new Date("2026-07-15T08:00:00");

  it("sin fecha → 'sin-fecha'", () => {
    expect(expiryStatus("", now)).toBe("sin-fecha");
  });
  it("fecha pasada → 'vencido'", () => {
    expect(expiryStatus("2026-07-01", now)).toBe("vencido");
  });
  it("dentro de los 30 días → 'por-vencer'", () => {
    expect(expiryStatus("2026-08-10", now)).toBe("por-vencer");
  });
  it("justo en el límite de 30 días → 'por-vencer' (inclusivo)", () => {
    expect(expiryStatus("2026-08-14", now)).toBe("por-vencer");
  });
  it("más allá de los 30 días → 'ok'", () => {
    expect(expiryStatus("2026-12-01", now)).toBe("ok");
  });
  it("respeta un umbral personalizado", () => {
    expect(expiryStatus("2026-09-30", now, 90)).toBe("por-vencer");
    expect(expiryStatus("2026-09-30", now, 30)).toBe("ok");
  });
});

describe("expiringCount", () => {
  const now = new Date("2026-07-15T08:00:00");

  it("cuenta activos vencidos o por vencer, ignorando los ok y sin fecha", () => {
    const list = [
      med({ id: "a", expiresAt: "2026-07-01" }), // vencido
      med({ id: "b", expiresAt: "2026-08-01" }), // por vencer
      med({ id: "c", expiresAt: "2027-01-01" }), // ok
      med({ id: "d", expiresAt: "" }), // sin fecha
    ];
    expect(expiringCount(list, now)).toBe(2);
  });
  it("excluye los medicamentos dados de baja aunque estén vencidos", () => {
    const list = [
      med({ id: "a", expiresAt: "2026-07-01", active: false }),
      med({ id: "b", expiresAt: "2026-08-01" }),
    ];
    expect(expiringCount(list, now)).toBe(1);
  });
});

describe("expirySummary", () => {
  const now = new Date("2026-07-15T08:00:00");

  it("separa vencidos y por vencer entre los activos", () => {
    const list = [
      med({ id: "a", expiresAt: "2026-07-01" }), // vencido
      med({ id: "b", expiresAt: "2026-06-20" }), // vencido
      med({ id: "c", expiresAt: "2026-08-01" }), // por vencer
      med({ id: "d", expiresAt: "2027-01-01" }), // ok
      med({ id: "e", expiresAt: "" }), // sin fecha
    ];
    expect(expirySummary(list, now)).toEqual({ expired: 2, soon: 1 });
  });
  it("ignora los dados de baja", () => {
    const list = [
      med({ id: "a", expiresAt: "2026-07-01", active: false }),
      med({ id: "b", expiresAt: "2026-08-01", active: false }),
    ];
    expect(expirySummary(list, now)).toEqual({ expired: 0, soon: 0 });
  });
  it("con lista vacía devuelve ceros", () => {
    expect(expirySummary([], now)).toEqual({ expired: 0, soon: 0 });
  });
});

describe("pharmacistNameByEmail / displayPharmacist", () => {
  const pharmacists = [
    { id: "1", name: "Ana Rojas", email: "ana@hospital.cr", license: "CF-1" },
    { id: "2", name: "Luis Mora", email: "Luis@Hospital.CR", license: "CF-2" },
  ];

  it("indexa por correo en minúscula", () => {
    const map = pharmacistNameByEmail(pharmacists);
    expect(map.get("ana@hospital.cr")).toBe("Ana Rojas");
    expect(map.get("luis@hospital.cr")).toBe("Luis Mora");
  });
  it("resuelve el nombre sin distinguir mayúsculas del correo", () => {
    const map = pharmacistNameByEmail(pharmacists);
    expect(displayPharmacist("ANA@hospital.cr", map)).toBe("Ana Rojas");
  });
  it("usa el correo como respaldo si no está en el mapa", () => {
    const map = pharmacistNameByEmail(pharmacists);
    expect(displayPharmacist("otro@hospital.cr", map)).toBe("otro@hospital.cr");
  });
  it("con correo vacío devuelve cadena vacía", () => {
    const map = pharmacistNameByEmail(pharmacists);
    expect(displayPharmacist("", map)).toBe("");
  });
});
