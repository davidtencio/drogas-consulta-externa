// Utilidades de paginación puras y genéricas (sin React), fáciles de probar.

/** Número total de páginas (mínimo 1, incluso con lista vacía). */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Limita una página al rango válido [1, pageCount]. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const last = pageCount(total, pageSize);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), last);
}

/** Devuelve la porción de `items` correspondiente a la página (1-indexada). */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  if (pageSize <= 0) return [...items];
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Rango 1-indexado mostrado en la página actual, para textos tipo "1–20 de 57". */
export function pageRange(
  total: number,
  page: number,
  pageSize: number
): { start: number; end: number } {
  if (total <= 0 || pageSize <= 0) return { start: 0, end: 0 };
  const current = clampPage(page, total, pageSize);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  return { start, end };
}
