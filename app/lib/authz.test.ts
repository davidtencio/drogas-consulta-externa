import { describe, expect, it } from "vitest";
import { canManageCatalog, canOperateInventory, roleForEmail } from "./authz";

describe("autorización por roles", () => {
  it("reconoce administrador sin depender de mayúsculas", () => expect(roleForEmail("DAVIDTENCIO@gmail.com")).toBe("admin"));
  it("reconoce operador", () => expect(roleForEmail("fhsvp2208@gmail.com")).toBe("operator"));
  it("rechaza correos fuera de lista", () => expect(roleForEmail("otro@ejemplo.com")).toBe("unauthorized"));
  it("separa administración de operación", () => {
    expect(canManageCatalog("operator")).toBe(false);
    expect(canOperateInventory("operator")).toBe(true);
    expect(canManageCatalog("admin")).toBe(true);
  });
});
