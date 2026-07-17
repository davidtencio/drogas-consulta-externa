import { expiryStatus, isLowStock, stockPercent, type Medicine, type MovementType } from "../lib/inventory";

type Props = {
  medicine: Medicine;
  lastCount?: string;
  onMovement: (type: MovementType) => void;
  onCount: () => void;
};

/** Tarjeta de un medicamento en el dashboard, con estado de stock y vencimiento. */
export function MedicineCard({ medicine: m, lastCount, onMovement, onCount }: Props) {
  const pct = stockPercent(m);
  const status = isLowStock(m) ? "low" : "ok";
  const exp = expiryStatus(m.expiresAt);
  const lastCountLabel = lastCount
    ? new Date(lastCount).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })
    : "Sin arqueos";
  return (
    <article className="medicine-card">
      <div className="card-head">
        <span className="pill-icon">✚</span>
        <div className="badges">
          <span className={`badge ${status}`}>{status === "low" ? "Stock bajo" : "Disponible"}</span>
          {exp === "vencido" && <span className="badge expired">Vencido</span>}
          {exp === "por-vencer" && <span className="badge soon">Vence pronto</span>}
        </div>
      </div>
      <h2>{m.name}</h2>
      <p>{m.strength} · {m.form}</p>
      <div className="stock-row"><small>Existencia</small><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span><em>Mínimo {m.minimumStock.toLocaleString("es-CR")}</em></div>
      <div className="bar"><i className={status} style={{ width: `${pct}%` }} /></div>
      <div className="meta">
        <span>Lote<strong>{m.lot || "—"}</strong></span>
        <span>Vence<strong>{m.expiresAt ? new Date(m.expiresAt + "T12:00:00").toLocaleDateString("es-CR", { month: "short", year: "numeric" }) : "—"}</strong></span>
        <span>Últ. arqueo<strong>{lastCountLabel}</strong></span>
      </div>
      <div className="card-actions">
        <button className="card-action in" onClick={() => onMovement("IN")}>＋ Ingreso</button>
        <button className="card-action out" onClick={() => onMovement("OUT")}>− Egreso</button>
        <button className="card-action count" onClick={onCount}>≡ Conteo</button>
      </div>
    </article>
  );
}
