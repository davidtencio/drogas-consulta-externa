// Utilidades de descarga en el navegador (usan API del DOM).

/** Fecha actual como `YYYY-MM-DD`, útil para nombrar archivos. */
export function dateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Descarga `content` como archivo. Antepone un BOM UTF-8 para que Excel
 * muestre bien los acentos en los CSV.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  type = "text/csv;charset=utf-8;"
): void {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
