// Construcción de CSV pura (sin DOM ni Firestore), fácil de probar. La descarga
// en el navegador vive en app/page.tsx; aquí solo se arma el texto.

import type { Medicine, Movement } from "./inventory";

/** Escapa un valor para CSV: entre comillas si contiene coma, comilla o salto. */
export function escapeCsvValue(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Une filas (arreglos de celdas) en un CSV con saltos CRLF (estándar). */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

const MEDICINE_HEADERS = [
  "Código",
  "Nombre",
  "Concentración",
  "Forma",
  "Existencias",
  "Stock mínimo",
  "Unidad",
  "Lote",
  "Vence",
  "Estado",
] as const;

/** CSV del catálogo de medicamentos (incluye activos e inactivos). */
export function medicinesToCsv(medicines: readonly Medicine[]): string {
  const rows: unknown[][] = [ [...MEDICINE_HEADERS] ];
  for (const m of medicines) {
    rows.push([
      m.code ?? "",
      m.name,
      m.strength,
      m.form,
      m.stock,
      m.minimumStock,
      m.unit,
      m.lot,
      m.expiresAt,
      m.active === false ? "Inactivo" : "Activo",
    ]);
  }
  return toCsv(rows);
}

const MOVEMENT_HEADERS = [
  "Fecha",
  "Medicamento",
  "Tipo",
  "Cantidad",
  "Sistema",
  "Diferencia",
  "Prescripción",
  "Nota",
  "Responsable",
] as const;

/** Etiqueta legible del tipo de movimiento. */
function movementTypeLabel(type: Movement["type"]): string {
  return type === "IN" ? "Ingreso" : type === "OUT" ? "Egreso" : "Conteo";
}

/**
 * CSV de la bitácora de movimientos (ingresos/egresos/conteos). Las columnas
 * Sistema/Diferencia/Nota solo aplican a los conteos físicos. `resolvePharmacist`
 * permite mostrar el nombre del responsable en vez del correo.
 */
export function movementsToCsv(
  movements: readonly Movement[],
  resolvePharmacist: (email: string) => string = (email) => email
): string {
  const rows: unknown[][] = [ [...MOVEMENT_HEADERS] ];
  for (const mv of movements) {
    rows.push([
      mv.createdAt,
      mv.medicineName,
      movementTypeLabel(mv.type),
      mv.quantity,
      mv.type === "COUNT" ? mv.systemQuantity ?? "" : "",
      mv.type === "COUNT" ? mv.difference ?? "" : "",
      mv.prescriptionRef,
      mv.note ?? "",
      resolvePharmacist(mv.pharmacistEmail),
    ]);
  }
  return toCsv(rows);
}
