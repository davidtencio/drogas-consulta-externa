import { useEffect } from "react";

/** Lleva el foco al campo inválido cuando cambia el error del formulario modal. */
export function useFocusErrorField(errorField?: string, error?: string) {
  useEffect(() => {
    if (!errorField) return;
    document.querySelector<HTMLElement>(`.modal [name="${errorField}"]`)?.focus();
  }, [errorField, error]);
}

