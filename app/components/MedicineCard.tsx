import { expiryStatus, isLowStock, stockPercent, type Medicine } from "../lib/inventory";

type Props = {
  medicine: Medicine;
  onRegister: () => void;
};

/** Tarjeta de un medicamento en el dashboard, con estado de stock y vencimiento. */
export function MedicineCard({ medicine: m, onRegister }: Props) {
  const pct = stockPercent(m);
  const status = isLowStock(m) ? "low" : "ok";
  const exp = expiryStatus(m.expiresAt);
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
      <div className="stock-row"><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span></div>
      <div className="bar"><i className={status} style={{ width: `${pct}%` }} /></div>
      <div className="meta">
        <span>Lote<strong>{m.lot || "—"}</strong></span>
        <span>Vence<strong>{m.expiresAt ? new Date(m.expiresAt + "T12:00:00").toLocaleDateString("es-CR", { month: "short", year: "numeric" }) : "—"}</strong></span>
      </div>
      <button className="card-action" onClick={onRegister}>Registrar movimiento <span>→</span></button>
    </article>
  );
}
