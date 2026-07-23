import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync("firestore.rules", "utf8");

describe("reglas de producción", () => {
  it("separa administrador y operador", () => {
    expect(rules).toContain("function isAdmin()");
    expect(rules).toContain("function isOperator()");
  });

  it("el cliente no crea ni elimina el catálogo (lo hace el backend con Admin SDK)", () => {
    expect(rules).toContain("allow create, delete: if false;");
  });

  it("el cliente no escribe farmacéuticos (altas/bajas/ediciones por backend)", () => {
    const pharmacists = rules.slice(rules.indexOf("match /pharmacists"));
    expect(pharmacists).toContain("allow create, update, delete: if false;");
  });

  it("limita al operador a modificar stock y trazabilidad de lotes", () => {
    expect(rules).toContain("affectedKeys().hasOnly(['stock', 'lots', 'lot', 'expiresAt'])");
    expect(rules).toContain("request.resource.data.stock >= 0");
  });

  it("la bitácora de auditoría no se escribe desde el cliente", () => {
    const audit = rules.slice(rules.indexOf("match /auditLogs"));
    expect(audit).toContain("allow create, update, delete: if false;");
  });

  it("mantiene movimientos y eventos operativos inmutables y atribuibles", () => {
    // movements y operationalEvents conservan la escritura atribuible del cliente.
    expect(rules.match(/allow update, delete: if false;/g)).toHaveLength(2);
    expect(rules.match(/actorEmail == request.auth.token.email/g)).toHaveLength(2);
  });
});
