import { useState } from "react";
import { expiryStatus, isLowStock, stockPercent, type Medicine, type MovementType } from "../lib/inventory";
import { Icon } from "./Icon";
import { AccessibleDialog } from "./AccessibleDialog";

export type InventoryCertification = { createdAt: string; pharmacistName: string };

type Props = {
  medicine: Medicine;
  certification?: InventoryCertification;
  onMovement: (type: MovementType) => void;
  onCount: () => void;
  onViewMovements: () => void;
};

/** Tarjeta de un medicamento en el dashboard, con estado de stock y vencimiento. */
export function MedicineCard({ medicine: m, certification, onMovement, onCount, onViewMovements }: Props) {
  const [showCertification, setShowCertification] = useState(false);
  const pct = stockPercent(m);
  const status = isLowStock(m) ? "low" : "ok";
  const exp = expiryStatus(m.expiresAt);
  const certifiedAt = certification ? new Date(certification.createdAt) : null;
  const certificationDate = certifiedAt?.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const certificationTime = certifiedAt?.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
  const tooltip = certification ? `Fecha: ${certificationDate}\nHora: ${certificationTime}\nFarmacéutico: ${certification.pharmacistName}` : "";
  const availableLots = (m.lots || []).filter((lot) => lot.quantity > 0);
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
      <div className="medicine-code"><span>Código</span><strong>{m.code || "—"}</strong></div>
      <div className="stock-row"><small>Existencia</small><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span><em>Mínimo {m.minimumStock.toLocaleString("es-CR")}</em></div>
      <div className="bar" role="progressbar" aria-label={`Existencia de ${m.name} respecto al nivel de referencia`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct} % del nivel de referencia`}><i className={status} style={{ width: `${pct}%` }} /></div>
      <span className="sr-only">{pct} % del nivel de referencia</span>
      <div className="meta">
        <span>Lotes<strong>{availableLots.length ? `${availableLots.length} disponibles` : m.lot || "—"}</strong></span>
        <span>Vence<strong>{m.expiresAt ? new Date(m.expiresAt + "T12:00:00").toLocaleDateString("es-CR", { month: "short", year: "numeric" }) : "—"}</strong></span>
        <span>Certificación<strong>{certification ? <button type="button" className="certification-check" title={tooltip} aria-label={`Ver certificación de ${m.name}`} onClick={() => setShowCertification(true)}><Icon name="check" size={15} /></button> : "Sin toma certificada"}</strong></span>
      </div>
      <div className="card-actions">
        <button className="card-action in" onClick={() => onMovement("IN")} aria-label={`Registrar ingreso de ${m.name}`}><Icon name="plus" size={15} /> Ingreso</button>
        <button className="card-action out" onClick={() => onMovement("OUT")} aria-label={`Registrar egreso de ${m.name}`}><Icon name="minus" size={15} /> Egreso</button>
        <button className="card-action count" onClick={onCount} aria-label={`Confirmar conteo de ${m.name}`}><Icon name="count" size={15} /> Conteo</button>
      </div>
      {showCertification && certification && <AccessibleDialog title="Toma de inventario certificada" description={`Certificación de ${m.name} ${m.strength}.`} onClose={() => setShowCertification(false)}>
        <div className="certification-detail"><div><small>Fecha</small><strong>{certificationDate}</strong></div><div><small>Hora</small><strong>{certificationTime}</strong></div><div><small>Farmacéutico</small><strong>{certification.pharmacistName}</strong></div></div>
      </AccessibleDialog>}
    </article>
  );
}
