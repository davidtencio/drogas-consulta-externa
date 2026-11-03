import { useCallback, useMemo, useState } from "react";
import { displayPharmacist, type Medicine, type Movement } from "../lib/inventory";
import { ANALYTICS_PERIODS, periodStart, rankVoidedMedicines, rankVoidingPharmacists, voidTotals, type AnalyticsPeriod } from "../lib/analytics";
import { MovementRowsSkeleton } from "./Skeletons";

type Props = {
  /** Egresos anulados y movimientos editados (ver `useAnalyticsData`). */
  movements: readonly Movement[];
  medicines: readonly Medicine[];
  pharmacistNames: ReadonlyMap<string, string>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-CR")} ${n === 1 ? one : many}`;

/** Módulo de Analítica. Primera medición: anulaciones de egresos y correcciones de ingresos. */
export function AnalyticsTab({ movements, medicines, pharmacistNames, loading = false, error, onRetry }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("90d");
  const since = useMemo(() => periodStart(period), [period]);
  const medicineRows = useMemo(() => rankVoidedMedicines(movements, since), [movements, since]);
  const pharmacistRows = useMemo(() => rankVoidingPharmacists(movements, since), [movements, since]);
  const totals = useMemo(() => voidTotals(medicineRows, pharmacistRows), [medicineRows, pharmacistRows]);
  const medicineById = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);
  const resolveName = useCallback((email: string) => displayPharmacist(email, pharmacistNames), [pharmacistNames]);
  const medicineLabel = (row: { medicineId?: string; medicineName: string }) => {
    const med = row.medicineId ? medicineById.get(row.medicineId) : undefined;
    return med ? `${med.name} ${med.strength}` : row.medicineName;
  };
  const busy = loading || !!error;
  const topMedicine = medicineRows[0];
  const topPharmacist = pharmacistRows[0];

  const status = (cols: number, empty: string) => error
    ? <tr><td colSpan={cols} className="empty"><div role="alert">{error}</div>{onRetry && <button className="secondary" onClick={onRetry}>Reintentar</button>}</td></tr>
    : loading ? <MovementRowsSkeleton cols={cols} rows={3} />
    : <tr><td colSpan={cols} className="empty">{empty}</td></tr>;

  return <div className="analytics">
    <div className="panel" aria-busy={loading}>
      <div className="panel-title">
        <div><h2>Anulaciones y correcciones</h2><p>Egresos anulados por fecha de anulación e ingresos corregidos por fecha de edición. Los ingresos no se anulan: un ingreso equivocado se corrige con «Editar».</p></div>
        <label className="analytics-period">Período<select aria-label="Período de análisis" value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}>{ANALYTICS_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      </div>
      <div className="mov-summary" aria-label="Resumen de anulaciones del período">
        <div className="out"><small>Egresos anulados</small><strong>{busy ? "—" : totals.voidedOut}</strong><em>en el período</em></div>
        <div><small>Medicamentos afectados</small><strong>{busy ? "—" : totals.medicines}</strong><em>con al menos una anulación</em></div>
        <div className="in"><small>Ingresos corregidos</small><strong>{busy ? "—" : totals.correctedIn}</strong><em>ediciones de ingresos</em></div>
        <div><small>Farmacéuticos</small><strong>{busy ? "—" : totals.people}</strong><em>responsables con anulaciones o correcciones</em></div>
      </div>
      {!busy && (topMedicine || topPharmacist) && <p className="mov-scope analytics-highlight">
        {topMedicine && <>Medicamento con más anulaciones: <strong>{medicineLabel(topMedicine)}</strong> ({plural(topMedicine.voids, "egreso anulado", "egresos anulados")}). </>}
        {topPharmacist && <>Farmacéutico con más anulaciones y correcciones: <strong>{resolveName(topPharmacist.email)}</strong> ({plural(topPharmacist.voidedOut, "egreso anulado", "egresos anulados")} y {plural(topPharmacist.correctedIn, "ingreso corregido", "ingresos corregidos")}).</>}
      </p>}
    </div>

    <div className="analytics-grid">
      <section className="panel" aria-labelledby="analytics-medicines">
        <div className="panel-title"><div><h2 id="analytics-medicines">Medicamentos más anulados</h2><p>Egresos anulados y unidades reintegradas al inventario.</p></div></div>
        <div className="table-wrap analytics-table">
          <table>
            <thead><tr><th>#</th><th>Medicamento</th><th>Anulaciones</th><th>Unidades reintegradas</th><th>Última anulación</th></tr></thead>
            <tbody>
              {busy || !medicineRows.length ? status(5, "No hay egresos anulados en el período.") : medicineRows.map((row, i) => (
                <tr key={row.key} className={i === 0 ? "analytics-top" : undefined}>
                  <td data-label="Posición">{i + 1}</td>
                  <td data-label="Medicamento"><strong>{medicineLabel(row)}</strong></td>
                  <td data-label="Anulaciones">{row.voids.toLocaleString("es-CR")}</td>
                  <td data-label="Unidades reintegradas"><span>{row.quantity.toLocaleString("es-CR")} <small>{row.medicineId ? medicineById.get(row.medicineId)?.unit ?? "" : ""}</small></span></td>
                  <td data-label="Última anulación">{formatDate(row.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="analytics-pharmacists">
        <div className="panel-title"><div><h2 id="analytics-pharmacists">Farmacéuticos que más anulan</h2><p>Responsable registrado en los egresos anulados y en los ingresos corregidos (columna Responsable de Movimientos).</p></div></div>
        <div className="table-wrap analytics-table">
          <table>
            <thead><tr><th>#</th><th>Farmacéutico</th><th>Egresos anulados</th><th>Ingresos corregidos</th><th>Total</th></tr></thead>
            <tbody>
              {busy || !pharmacistRows.length ? status(5, "Nadie ha anulado egresos ni corregido ingresos en el período.") : pharmacistRows.map((row, i) => (
                <tr key={row.email} className={i === 0 ? "analytics-top" : undefined}>
                  <td data-label="Posición">{i + 1}</td>
                  <td data-label="Farmacéutico"><div><strong>{resolveName(row.email)}</strong><small className="cell-sub">Última acción: {formatDate(row.lastAt)}</small></div></td>
                  <td data-label="Egresos anulados">{row.voidedOut.toLocaleString("es-CR")}</td>
                  <td data-label="Ingresos corregidos">{row.correctedIn.toLocaleString("es-CR")}</td>
                  <td data-label="Total"><strong>{row.total.toLocaleString("es-CR")}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>;
}
