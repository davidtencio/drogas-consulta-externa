// Modelo del reporte de movimientos: lógica pura (sin DOM, Firestore ni jsPDF)
// que convierte los movimientos filtrados en textos listos para maquetar. El
// renderizado a PDF vive en `movementsPdf.ts`.

import type { Movement } from "./inventory";
import { summarizeMovements, type MovementTypeFilter } from "./movements";

export type MovementsReportOptions = {
  /** Fecha inicial `YYYY-MM-DD` del filtro (UTC, inclusiva). */
  from?: string;
  /** Fecha final `YYYY-MM-DD` del filtro (UTC, inclusiva). */
  to?: string;
  type?: MovementTypeFilter;
  text?: string;
  /** Medicamento filtrado (nombre legible y unidad), si lo hay. */
  medicine?: { name: string; unit: string };
  /** Nombre legible del responsable filtrado, si lo hay. */
  pharmacist?: string;
  /** Unidad por id de medicamento para mostrar cantidades con su unidad. */
  units?: ReadonlyMap<string, string>;
  /** Nombre (o correo) de quien genera el reporte. */
  generatedBy: string;
  resolvePharmacist?: (email: string) => string;
  now?: Date;
  /** Zona horaria de las fechas impresas; por defecto, la del navegador. */
  timeZone?: string;
};

export type MovementsReportRow = {
  kind: Movement["type"];
  voided: boolean;
  date: string;
  medicine: string;
  lots: string;
  type: string;
  quantity: string;
  prescription: string;
  responsible: string;
  status: string;
  /** Líneas secundarias: observación, motivo de anulación, conteo, ediciones. */
  details: string[];
};

export type MovementsReport = {
  title: string;
  organization: string;
  period: string;
  filters: { label: string; value: string }[];
  generatedAt: string;
  generatedBy: string;
  summary: { label: string; value: string; detail: string }[];
  rows: MovementsReportRow[];
  /** Aclaraciones al pie del reporte. */
  notes: string[];
};

const TYPE_LABEL: Record<Movement["type"], string> = { IN: "Ingreso", OUT: "Egreso", COUNT: "Conteo" };
const TYPE_FILTER_LABEL: Record<MovementTypeFilter, string> = { ALL: "Todos", IN: "Ingresos", OUT: "Egresos", COUNT: "Conteos" };

const number = (n: number) => n.toLocaleString("es-CR");

/** `YYYY-MM-DD` → "1 oct 2026", sin desplazar el día por la zona horaria. */
export function formatReportDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(/\./g, "");
}

/** Texto del período consultado según Desde / Hasta. */
export function reportPeriod(from?: string, to?: string): string {
  if (from && to) return from === to ? `${formatReportDay(from)}` : `Del ${formatReportDay(from)} al ${formatReportDay(to)}`;
  if (from) return `Desde el ${formatReportDay(from)}`;
  if (to) return `Hasta el ${formatReportDay(to)}`;
  return "Historial completo";
}

function formatDateTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
}

/** Arma el reporte a partir de los movimientos ya filtrados y ordenados. */
export function buildMovementsReport(movements: readonly Movement[], options: MovementsReportOptions): MovementsReport {
  const resolve = options.resolvePharmacist ?? ((email: string) => email);
  const tz = options.timeZone;
  const unitOf = (m: Movement) => options.units?.get(m.medicineId ?? "") ?? "";
  const s = summarizeMovements(movements);

  const filters: MovementsReport["filters"] = [];
  if (options.medicine) filters.push({ label: "Medicamento", value: options.medicine.name });
  if (options.type && options.type !== "ALL") filters.push({ label: "Tipo", value: TYPE_FILTER_LABEL[options.type] });
  if (options.pharmacist) filters.push({ label: "Responsable", value: options.pharmacist });
  if (options.text?.trim()) filters.push({ label: "Búsqueda", value: `“${options.text.trim()}”` });

  const unit = options.medicine?.unit ? ` ${options.medicine.unit}` : "";
  const summary: MovementsReport["summary"] = [
    { label: "Registros", value: number(s.count), detail: s.medicineCount === 1 ? "1 medicamento" : `${number(s.medicineCount)} medicamentos` },
    { label: "Ingresos", value: number(s.inCount), detail: options.medicine ? `${number(s.inQuantity)}${unit}` : "operaciones" },
    { label: "Egresos", value: number(s.outCount), detail: options.medicine ? `${number(s.outQuantity)}${unit}` : "operaciones vigentes" },
    { label: "Anulados", value: number(s.voidedCount), detail: "no suman en totales" },
    { label: "Conteos", value: number(s.countEvents), detail: "tomas de inventario" },
  ];

  const rows = movements.map((m): MovementsReportRow => {
    const details: string[] = [];
    if (m.type === "COUNT") {
      const diff = m.difference ?? 0;
      details.push(`Sistema: ${number(m.systemQuantity ?? 0)} · Diferencia: ${diff > 0 ? "+" : ""}${number(diff)}`);
    }
    if (m.note) details.push(`Observación: ${m.note}`);
    if (m.voidedAt) {
      details.push(`Anulado el ${formatDateTime(m.voidedAt, tz)}${m.voidedByEmail ? ` por ${resolve(m.voidedByEmail)}` : ""}${m.voidReason ? `. Motivo: ${m.voidReason}` : ""}`);
    }
    const edits = m.editHistory?.length ?? 0;
    if (edits) details.push(`Editado ${edits === 1 ? "1 vez" : `${edits} veces`}`);
    else if (m.updatedAt && !m.voidedAt) details.push("Editado (sin historial)");
    const u = unitOf(m);
    return {
      kind: m.type,
      voided: Boolean(m.voidedAt),
      date: formatDateTime(m.createdAt, tz),
      medicine: m.medicineName,
      lots: m.lotAllocations?.map((lot) => `${lot.lot}: ${number(lot.quantity)}`).join(" · ") ?? "",
      type: TYPE_LABEL[m.type],
      quantity: `${number(m.quantity)}${u ? ` ${u}` : ""}`,
      prescription: m.prescriptionRef || "—",
      responsible: resolve(m.pharmacistEmail),
      status: m.voidedAt ? "Anulado" : "Vigente",
      details,
    };
  });

  const now = options.now ?? new Date();
  return {
    title: options.medicine ? `Movimientos de ${options.medicine.name}` : "Reporte de movimientos",
    organization: "Control de Drogas · Consulta Externa",
    period: reportPeriod(options.from, options.to),
    filters,
    generatedAt: formatDateTime(now.toISOString(), tz),
    generatedBy: options.generatedBy,
    summary,
    rows,
    notes: [
      "Las fechas de los filtros Desde / Hasta corresponden a la fecha UTC del registro; las fechas de la tabla se muestran en hora local.",
      "Los egresos anulados se conservan por trazabilidad y no suman en los totales.",
    ],
  };
}
