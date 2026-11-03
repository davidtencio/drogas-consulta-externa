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

  it("limita al operador a modificar stock, lotes y marca de última toma", () => {
    expect(rules).toContain("affectedKeys().hasOnly(['stock', 'lots', 'lot', 'expiresAt', 'lastCountAt', 'lastCountBy'])");
    expect(rules).toContain("request.resource.data.stock >= 0");
  });

  it("la bitácora de auditoría no se escribe desde el cliente", () => {
    const audit = rules.slice(rules.indexOf("match /auditLogs"));
    expect(audit).toContain("allow create, update, delete: if false;");
  });

  it("permite editar únicamente ingresos y egresos atribuibles al operador e impide borrar movimientos", () => {
    // operationalEvents conserva allow update, delete: if false; movements solo permite update en IN/OUT atribuibles.
    expect(rules.match(/allow update, delete: if false;/g)).toHaveLength(1);
    expect(rules).toContain("resource.data.type in ['IN', 'OUT']");
    expect(rules).toContain("request.resource.data.type in ['IN', 'OUT']");
    expect(rules).toContain("allow delete: if false;");
    expect(rules.match(/actorEmail == request.auth.token.email/g)).toHaveLength(3);
  });

  it("anula egresos sin borrarlos: solo campos de anulación, con motivo, y lo anulado queda inmutable", () => {
    expect(rules).toContain("!('voidedAt' in resource.data)");
    expect(rules).toContain("resource.data.type == 'OUT'");
    expect(rules).toContain(".hasOnly(['voidedAt', 'voidedByEmail', 'voidReason', 'actorEmail'])");
    expect(rules).toContain("request.resource.data.voidReason.size() >= 10");
  });

  it("cada edición agrega al historial la versión anterior y no reescribe entradas previas", () => {
    expect(rules).toContain("isValidVoid() : isValidEdit()");
    expect(rules).toContain("after.size() == before.size() + 1");
    expect(rules).toContain("(before.size() == 0 || after[0:before.size()] == before)");
    expect(rules).toContain("entry.editedByEmail == request.auth.token.email");
    expect(rules).toContain("prev.quantity == resource.data.quantity");
  });
});
