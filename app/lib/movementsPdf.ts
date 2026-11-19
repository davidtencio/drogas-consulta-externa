// Maquetación del reporte de movimientos en PDF con jsPDF + jspdf-autotable.
// Las bibliotecas se importan bajo demanda para que solo se descarguen cuando
// alguien exporta. El contenido sale de `buildMovementsReport` (lógica pura).

import type { MovementsReport, MovementsReportRow } from "./movementsReport";

type RGB = [number, number, number];
const BRAND: RGB = [33, 163, 153];
const BRAND_DARK: RGB = [14, 94, 88];
const INK: RGB = [17, 24, 39];
const MUTED: RGB = [100, 116, 139];
const BORDER: RGB = [222, 229, 236];
const ZEBRA: RGB = [246, 250, 250];
const WHITE: RGB = [255, 255, 255];
const TYPE_COLOR: Record<MovementsReportRow["kind"], RGB> = { IN: [21, 128, 61], OUT: [185, 28, 28], COUNT: [29, 78, 216] };
const VOID_COLOR: RGB = [148, 163, 184];

const MARGIN = 36;
const TOTAL_PAGES = "{total_pages}";

/** Genera el PDF (carta, horizontal) y lo devuelve como `Blob`. */
export async function renderMovementsPdf(report: MovementsReport): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  doc.setProperties({ title: `${report.title} — ${report.period}`, subject: "Trazabilidad de medicamentos controlados", creator: report.organization, author: report.generatedBy });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const color = (rgb: RGB, kind: "text" | "fill" | "draw" = "text") => {
    if (kind === "text") doc.setTextColor(...rgb);
    else if (kind === "fill") doc.setFillColor(...rgb);
    else doc.setDrawColor(...rgb);
  };
  const font = (size: number, style: "normal" | "bold" | "italic" = "normal", rgb: RGB = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(rgb);
  };

  // El total se sustituye al final (putTotalPages), así que no se puede
  // alinear a la derecha: se alinea a la izquierda en una posición fija.
  const pageNumber = (n: number) => {
    font(7.5, "normal", MUTED);
    doc.text(`Página ${n} de ${TOTAL_PAGES}`, W - MARGIN - 62, H - 20);
  };

  // ── Encabezado principal ──────────────────────────────────────────────
  color(BRAND_DARK, "fill");
  doc.rect(0, 0, W, 78, "F");
  color(BRAND, "fill");
  doc.rect(0, 78, W, 4, "F");
  color(WHITE, "fill");
  doc.roundedRect(MARGIN, 18, 42, 42, 8, 8, "F");
  font(20, "bold", BRAND_DARK);
  doc.text("Rx", MARGIN + 21, 46, { align: "center" });
  font(18, "bold", WHITE);
  doc.text(report.title, MARGIN + 56, 36, { maxWidth: W - MARGIN * 2 - 260 });
  font(10, "normal", [204, 238, 234]);
  doc.text(report.organization, MARGIN + 56, 54);
  font(8, "normal", [204, 238, 234]);
  doc.text("GENERADO", W - MARGIN, 30, { align: "right" });
  font(10, "bold", WHITE);
  doc.text(report.generatedAt, W - MARGIN, 44, { align: "right" });
  font(9, "normal", WHITE);
  doc.text(report.generatedBy, W - MARGIN, 58, { align: "right", maxWidth: 240 });

  // ── Período y filtros ─────────────────────────────────────────────────
  let y = 108;
  font(8, "bold", MUTED);
  doc.text("PERÍODO", MARGIN, y);
  font(12, "bold", INK);
  doc.text(report.period, MARGIN, y + 15);
  if (report.filters.length) {
    font(8, "bold", MUTED);
    doc.text("FILTROS APLICADOS", W / 2 - 40, y);
    font(10, "normal", INK);
    const filterText = report.filters.map((f) => `${f.label}: ${f.value}`).join("   ·   ");
    doc.text(filterText, W / 2 - 40, y + 15, { maxWidth: W / 2 + 40 - MARGIN });
  }

  // ── Tarjetas de resumen ───────────────────────────────────────────────
  y += 34;
  const gap = 10;
  const cardW = (W - MARGIN * 2 - gap * (report.summary.length - 1)) / report.summary.length;
  const cardH = 56;
  report.summary.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    color(WHITE, "fill");
    color(BORDER, "draw");
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, cardW, cardH, 5, 5, "FD");
    color(i === 0 ? BRAND : i === 1 ? TYPE_COLOR.IN : i === 2 ? TYPE_COLOR.OUT : i === 3 ? VOID_COLOR : TYPE_COLOR.COUNT, "fill");
    doc.rect(x, y + 6, 3, cardH - 12, "F");
    font(8, "bold", MUTED);
    doc.text(card.label.toUpperCase(), x + 12, y + 16);
    font(18, "bold", INK);
    doc.text(card.value, x + 12, y + 37);
    font(8, "normal", MUTED);
    doc.text(card.detail, x + 12, y + 49, { maxWidth: cardW - 18 });
  });
  y += cardH + 18;

  // ── Tabla de movimientos ──────────────────────────────────────────────
  type Cell = { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  const meta: { row: MovementsReportRow; detail: boolean; zebra: boolean }[] = [];
  report.rows.forEach((row, i) => {
    const zebra = i % 2 === 1;
    const fill = zebra ? ZEBRA : WHITE;
    body.push([
      { content: row.date },
      { content: row.medicine },
      { content: row.type },
      { content: row.quantity },
      { content: row.prescription },
      { content: row.responsible },
      { content: row.status },
    ].map((cell) => ({ ...cell, styles: { fillColor: fill } })));
    meta.push({ row, detail: false, zebra });
    const details = row.lots ? [`Lotes: ${row.lots}`, ...row.details] : row.details;
    if (details.length) {
      body.push([{ content: details.join("\n"), colSpan: 7, styles: { fillColor: fill, fontSize: 7.5, fontStyle: "italic", textColor: MUTED, cellPadding: { top: 0, right: 8, bottom: 6, left: 8 } } }]);
      meta.push({ row, detail: true, zebra });
    }
  });
  if (!body.length) body.push([{ content: "No hay movimientos para los filtros elegidos.", colSpan: 7, styles: { halign: "center", textColor: MUTED, fontStyle: "italic" } }]);

  autoTable(doc, {
    startY: y,
    margin: { top: 64, right: MARGIN, bottom: 46, left: MARGIN },
    head: [["Fecha", "Medicamento", "Tipo", "Cantidad", "Prescripción", "Responsable", "Estado"]],
    body,
    theme: "plain",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: { top: 6, right: 8, bottom: 6, left: 8 }, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: BRAND_DARK, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 190 },
      2: { cellWidth: 56 },
      3: { cellWidth: 72, halign: "right" },
      4: { cellWidth: 100 },
      5: { cellWidth: "auto" },
      6: { cellWidth: 58 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const info = meta[data.row.index];
      if (!info || info.detail) return;
      if (info.row.voided) data.cell.styles.textColor = VOID_COLOR;
      if (data.column.index === 1) data.cell.styles.fontStyle = "bold";
      if (data.column.index === 2) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = info.row.voided ? VOID_COLOR : TYPE_COLOR[info.row.kind];
      }
      if (data.column.index === 6) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = info.row.voided ? TYPE_COLOR.OUT : TYPE_COLOR.IN;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const info = meta[data.row.index];
      // Cantidad anulada: tachada, como en la pantalla.
      if (info?.row.voided && !info.detail && data.column.index === 3) {
        const text = info.row.quantity;
        doc.setFontSize(8.5);
        const tw = doc.getTextWidth(text);
        const right = data.cell.x + data.cell.width - 8;
        const lineY = data.cell.y + 6 + 8.5 * 0.35;
        doc.setDrawColor(...VOID_COLOR);
        doc.setLineWidth(0.7);
        doc.line(right - tw, lineY, right, lineY);
      }
    },
    didDrawPage: (data) => {
      // Encabezado compacto a partir de la segunda página.
      if (data.pageNumber > 1) {
        color(BRAND_DARK, "fill");
        doc.rect(0, 0, W, 6, "F");
        font(11, "bold", INK);
        doc.text(report.title, MARGIN, 32);
        font(9, "normal", MUTED);
        doc.text(report.period, MARGIN, 46);
        doc.text(`Generado ${report.generatedAt}`, W - MARGIN, 32, { align: "right" });
      }
      // Pie de página.
      color(BORDER, "draw");
      doc.setLineWidth(0.5);
      doc.line(MARGIN, H - 32, W - MARGIN, H - 32);
      font(7.5, "normal", MUTED);
      doc.text(`${report.organization} — Documento de trazabilidad de medicamentos controlados`, MARGIN, H - 20);
      pageNumber(data.pageNumber);
    },
  });

  // ── Notas y firmas ────────────────────────────────────────────────────
  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? y) + 22;
  const closingHeight = 24 + report.notes.length * 11 + 70;
  if (y + closingHeight > H - 46) {
    doc.addPage();
    y = 72;
    font(11, "bold", INK);
    doc.text(report.title, MARGIN, 32);
    font(9, "normal", MUTED);
    doc.text(report.period, MARGIN, 46);
    color(BORDER, "draw");
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 32, W - MARGIN, H - 32);
    font(7.5, "normal", MUTED);
    doc.text(`${report.organization} — Documento de trazabilidad de medicamentos controlados`, MARGIN, H - 20);
    pageNumber(doc.getNumberOfPages());
  }
  font(8, "bold", MUTED);
  doc.text("NOTAS", MARGIN, y);
  font(8, "normal", MUTED);
  report.notes.forEach((note, i) => doc.text(`• ${note}`, MARGIN, y + 13 + i * 11, { maxWidth: W - MARGIN * 2 }));
  y += 13 + report.notes.length * 11 + 44;
  const sigW = 220;
  [["Elaborado por", report.generatedBy], ["Revisado por", ""]].forEach(([label, name], i) => {
    const x = MARGIN + i * (sigW + 60);
    color(INK, "draw");
    doc.setLineWidth(0.6);
    doc.line(x, y, x + sigW, y);
    font(8, "bold", INK);
    doc.text(label, x, y + 12);
    if (name) {
      font(8, "normal", MUTED);
      doc.text(name, x, y + 23, { maxWidth: sigW });
    }
  });

  doc.putTotalPages(TOTAL_PAGES);
  return doc.output("blob");
}
