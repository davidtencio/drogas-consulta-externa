import { describe, it, expect } from "vitest";
import { escapeCsvValue, toCsv, medicinesToCsv } from "./csv";
import type { Medicine } from "./inventory";

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

describe("escapeCsvValue", () => {
  it("deja los valores simples sin comillas", () => {
    expect(escapeCsvValue("Metformina")).toBe("Metformina");
    expect(escapeCsvValue(500)).toBe("500");
  });
  it("representa null/undefined como cadena vacía", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });
  it("entrecomilla valores con coma", () => {
    expect(escapeCsvValue("Ibuprofeno, 400 mg")).toBe('"Ibuprofeno, 400 mg"');
  });
  it("duplica las comillas internas y entrecomilla", () => {
    expect(escapeCsvValue('Tableta "recubierta"')).toBe('"Tableta ""recubierta"""');
  });
  it("entrecomilla valores con saltos de línea", () => {
    expect(escapeCsvValue("línea1\nlínea2")).toBe('"línea1\nlínea2"');
  });
});

describe("toCsv", () => {
  it("une celdas con coma y filas con CRLF", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });
});

describe("medicinesToCsv", () => {
  it("incluye encabezados y una fila por medicamento", () => {
    const csv = medicinesToCsv([med({ name: "Metformina", stock: 100, code: "123-45-6789" })]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Código,Nombre,Concentración,Forma,Existencias,Stock mínimo,Unidad,Lote,Vence,Estado"
    );
    expect(lines[1]).toBe("123-45-6789,Metformina,500 mg,Tableta,100,20,unidades,L1,2027-01-01,Activo");
    expect(lines).toHaveLength(2);
  });
  it("marca los inactivos y escapa nombres con coma", () => {
    const csv = medicinesToCsv([
      med({ name: "Amoxi, 875", active: false }),
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Amoxi, 875"');
    expect(row.endsWith(",Inactivo")).toBe(true);
  });
  it("con lista vacía solo devuelve los encabezados", () => {
    const csv = medicinesToCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
