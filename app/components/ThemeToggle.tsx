"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "light" | "dark";

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

/** Botón para alternar entre tema claro y oscuro; persiste la elección en localStorage. */
export function ThemeToggle() {
  // Inicia en null para que el primer render coincida con el del servidor (sin desajuste de hidratación).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      const v = localStorage.getItem("theme");
      if (v === "light" || v === "dark") stored = v;
    } catch {
      /* localStorage no disponible */
    }
    const current = document.documentElement.getAttribute("data-theme") as Theme | null;
    // Sincronización única al montar: arrancamos en null para que el primer render
    // coincida con el del servidor y no rompa la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored ?? current ?? (prefersDark() ? "dark" : "light"));
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* localStorage no disponible */
    }
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title="Cambiar tema"
    >
      <span aria-hidden="true"><Icon name={isDark ? "sun" : "moon"} size={17} /></span>
      <span className="theme-toggle-label">{isDark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
