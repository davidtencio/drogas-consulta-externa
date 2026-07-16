import { describe, it, expect } from "vitest";
import { pageCount, clampPage, paginate, pageRange } from "./pagination";

const items = Array.from({ length: 57 }, (_, i) => i + 1); // 1..57

describe("pageCount", () => {
  it("redondea hacia arriba", () => {
    expect(pageCount(57, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });
  it("es al menos 1, incluso con lista vacía", () => {
    expect(pageCount(0, 20)).toBe(1);
  });
  it("devuelve 1 si el tamaño de página no es válido", () => {
    expect(pageCount(57, 0)).toBe(1);
  });
});

describe("clampPage", () => {
  it("mantiene una página dentro del rango", () => {
    expect(clampPage(2, 57, 20)).toBe(2);
  });
  it("limita al máximo cuando se pasa", () => {
    expect(clampPage(99, 57, 20)).toBe(3);
  });
  it("nunca baja de 1", () => {
    expect(clampPage(0, 57, 20)).toBe(1);
    expect(clampPage(-5, 57, 20)).toBe(1);
  });
});

describe("paginate", () => {
  it("devuelve la primera página", () => {
    expect(paginate(items, 1, 20)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("devuelve una página intermedia", () => {
    expect(paginate(items, 2, 20)[0]).toBe(21);
    expect(paginate(items, 2, 20)).toHaveLength(20);
  });
  it("la última página puede ser parcial", () => {
    const last = paginate(items, 3, 20);
    expect(last).toHaveLength(17);
    expect(last[last.length - 1]).toBe(57);
  });
  it("una página fuera de rango se limita a la última", () => {
    expect(paginate(items, 99, 20)[0]).toBe(41);
  });
  it("con lista vacía devuelve vacío", () => {
    expect(paginate([], 1, 20)).toEqual([]);
  });
});

describe("pageRange", () => {
  it("describe el rango mostrado (1-indexado)", () => {
    expect(pageRange(57, 1, 20)).toEqual({ start: 1, end: 20 });
    expect(pageRange(57, 2, 20)).toEqual({ start: 21, end: 40 });
    expect(pageRange(57, 3, 20)).toEqual({ start: 41, end: 57 });
  });
  it("con total 0 devuelve 0–0", () => {
    expect(pageRange(0, 1, 20)).toEqual({ start: 0, end: 0 });
  });
});
