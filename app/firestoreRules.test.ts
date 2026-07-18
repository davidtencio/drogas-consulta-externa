import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync("firestore.rules", "utf8");

describe("reglas del piloto", () => {
  it("separa administrador y operador", () => {
    expect(rules).toContain("function isAdmin()");
    expect(rules).toContain("function isOperator()");
    expect(rules).toContain("allow create, update, delete: if isAdmin()");
  });

  it("limita al operador a modificar stock y trazabilidad de lotes", () => {
    expect(rules).toContain("affectedKeys().hasOnly(['stock', 'lots', 'lot', 'expiresAt'])");
    expect(rules).toContain("request.resource.data.stock >= 0");
  });

  it("mantiene movimientos y auditoría inmutables y atribuibles", () => {
    expect(rules.match(/allow update, delete: if false;/g)).toHaveLength(3);
    expect(rules.match(/actorEmail == request.auth.token.email/g)).toHaveLength(3);
  });
});
