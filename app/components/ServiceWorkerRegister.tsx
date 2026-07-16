"use client";

import { useEffect } from "react";

/** Registra el service worker (solo en producción y en el navegador). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registro best-effort: si falla, la app sigue funcionando online.
    });
  }, []);
  return null;
}
