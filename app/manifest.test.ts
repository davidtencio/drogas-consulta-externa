import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("declara una PWA instalable en modo standalone", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.name).toMatch(/Control de Drogas/);
    expect(m.short_name).toBeTruthy();
  });

  it("incluye un ícono normal y uno maskable", () => {
    const purposes = (manifest().icons ?? []).map((i) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });
});
