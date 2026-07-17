"use client";

import { useEffect } from "react";

const SW_VERSION = process.env.NEXT_PUBLIC_SW_VERSION ?? "";

/** Registra el service worker (solo en producción y en el navegador). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Si ya había un SW controlando la página, un cambio de controlador
    // significa que se activó una versión nueva: recargamos una sola vez.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // La versión va en la URL: cuando cambia (nuevo despliegue), el navegador
    // trata el archivo como un SW nuevo, lo instala y descarta la caché vieja.
    const url = SW_VERSION ? `/sw.js?v=${SW_VERSION}` : "/sw.js";
    navigator.serviceWorker
      .register(url)
      .then((reg) => {
        if (reg.waiting) reg.waiting.postMessage("skip-waiting");
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              next.postMessage("skip-waiting");
            }
          });
        });
      })
      .catch(() => {
        // Registro best-effort: si falla, la app sigue funcionando online.
      });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
