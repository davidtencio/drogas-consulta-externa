import { expiryStatus, isLowStock, stockPercent, type Medicine, type MovementType } from "../lib/inventory";
import { Icon } from "./Icon";

type Props = {
  medicine: Medicine;
  lastCount?: string;
  onMovement: (type: MovementType) => void;
  onCount: () => void;
  onViewMovements: () => void;
};

/** Tarjeta de un medicamento en el dashboard, con estado de stock y vencimiento. */
export function MedicineCard({ medicine: m, lastCount, onMovement, onCount, onViewMovements }: Props) {
  const pct = stockPercent(m);
  const status = isLowStock(m) ? "low" : "ok";
  const exp = expiryStatus(m.expiresAt);
  const lastCountLabel = lastCount
    ? new Date(lastCount).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })
    : "Sin arqueos";
  return (
    <article className="medicine-card">
      <button className="card-open" type="button" onClick={onViewMovements} aria-label={`Ver movimientos de ${m.name} ${m.strength}`} />
      <div className="card-head">
        <span className="pill-icon"><Icon name="pill" size={19} /></span>
        <div className="badges">
          <span className={`badge ${status}`}>{status === "low" ? "Stock bajo" : "Disponible"}</span>
          {exp === "vencido" && <span className="badge expired">Vencido</span>}
          {exp === "por-vencer" && <span className="badge soon">Vence pronto</span>}
        </div>
      </div>
      <h2>{m.name}</h2>
      <p>{m.strength} · {m.form}</p>
      <div className="stock-row"><small>Existencia</small><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span><em>Mínimo {m.minimumStock.toLocaleString("es-CR")}</em></div>
      <div className="bar" role="progressbar" aria-label={`Existencia de ${m.name} respecto al nivel de referencia`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct} % del nivel de referencia`}><i className={status} style={{ width: `${pct}%` }} /></div>
      <span className="sr-only">{pct} % del nivel de referencia</span>
      <div className="meta">
        <span>Lote<strong>{m.lot || "—"}</strong></span>
        <span>Vence<strong>{m.expiresAt ? new Date(m.expiresAt + "T12:00:00").toLocaleDateString("es-CR", { month: "short", year: "numeric" }) : "—"}</strong></span>
        <span>Últ. arqueo<strong>{lastCountLabel}</strong></span>
      </div>
      <div className="card-actions">
        <button className="card-action in" onClick={() => onMovement("IN")} aria-label={`Registrar ingreso de ${m.name}`}><Icon name="plus" size={15} /> Ingreso</button>
        <button className="card-action out" onClick={() => onMovement("OUT")} aria-label={`Registrar egreso de ${m.name}`}><Icon name="minus" size={15} /> Egreso</button>
        <button className="card-action count" onClick={onCount} aria-label={`Confirmar conteo de ${m.name}`}><Icon name="count" size={15} /> Conteo</button>
      </div>
    </article>
  );
}
