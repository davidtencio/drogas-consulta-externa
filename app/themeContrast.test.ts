import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/styles/tokens.css", "utf8");

function themeTokens(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "g"))];
  return blocks.reduce<Record<string, string>>((tokens, match) => {
    for (const item of match[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) tokens[item[1]] = item[2];
    return tokens;
  }, {});
}

function luminance(hex: string) {
  const values = hex.slice(1).match(/.{2}/g)?.map((part) => Number.parseInt(part, 16) / 255) ?? [];
  const [r, g, b] = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground: string, background: string) {
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function expectAa(tokens: Record<string, string>, pairs: [string, string][]) {
  for (const [foreground, background] of pairs) {
    expect(tokens[foreground], `Falta --${foreground}`).toBeTruthy();
    expect(tokens[background], `Falta --${background}`).toBeTruthy();
    expect(ratio(tokens[foreground], tokens[background]), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
  }
}

describe("contraste de temas", () => {
  it("mantiene texto y estados AA en tema claro", () => {
    const tokens = themeTokens(":root[data-theme=light]");
    expectAa(tokens, [["text", "surface"], ["text", "bg"], ["muted", "surface"], ["muted", "surface-2"], ["label", "surface"], ["faint", "surface"], ["primary-ink", "primary-tint"], ["primary-ink", "surface"], ["in", "in-tint"], ["out", "out-tint"], ["count", "count-tint"], ["crit", "crit-tint"], ["warn-ink", "warn-tint"], ["on-primary", "primary"], ["on-danger", "crit-solid"]]);
  });

  it("mantiene texto y estados AA en el tema oscuro", () => {
    const tokens = themeTokens(":root[data-theme=dark]");
    expectAa(tokens, [["text", "surface"], ["text", "bg"], ["muted", "surface"], ["muted", "surface-2"], ["label", "surface"], ["faint", "bg"], ["primary-ink", "primary-tint"], ["primary-ink", "surface"], ["in", "in-tint"], ["out", "out-tint"], ["count", "count-tint"], ["crit", "crit-tint"], ["warn-ink", "warn-tint"], ["on-primary", "primary"], ["on-danger", "crit-solid"]]);
  });

  it.each([":root[data-theme=light]", ":root[data-theme=dark]"])("distingue controles y foco en %s", (selector) => {
    const tokens = themeTokens(selector);
    for (const foreground of ["input-line", "focus"]) for (const background of ["surface", "surface-2", "bg"]) {
      expect(ratio(tokens[foreground], tokens[background]), `${foreground}/${background}`).toBeGreaterThanOrEqual(3);
    }
  });
});
