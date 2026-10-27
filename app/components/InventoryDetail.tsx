import type { Medicine, MovementType } from "../lib/inventory";
import { inventoryLotView } from "../lib/inventoryView";
import type { InventoryCertification } from "./MedicineCard";
import { AccessibleDialog } from "./AccessibleDialog";
import { LotExpiryLabel } from "./InventoryLabels";
import { Icon } from "./Icon";

type Props = {
  medicine: Medicine;
  certification?: InventoryCertification;
  onClose: () => void;
  onMovement: (type: MovementType) => void;
  onCount: () => void;
  onViewMovements: () => void;
};

export function InventoryDetail({ medicine, certification, onClose, onMovement, onCount, onViewMovements }: Props) {
  const view = inventoryLotView(medicine);
  return <AccessibleDialog title={`${medicine.name} ${medicine.strength}`} description={`${medicine.form} · Código ${medicine.code || "no registrado"}`} onClose={onClose}>
    <div className="inventory-detail">
      <dl className="inventory-detail-summary"><div><dt>Existencia registrada</dt><dd>{medicine.stock.toLocaleString("es-CR")} <span>{medicine.unit}</span></dd></div><div><dt>Stock mínimo</dt><dd>{medicine.minimumStock.toLocaleString("es-CR")} <span>{medicine.unit}</span></dd></div></dl>
      {view.legacy && <p className="inventory-data-note">Datos del registro general. Aún no hay un desglose de lotes almacenado; la cantidad corresponde al saldo registrado.</p>}
      {view.mismatch && <p className="inventory-data-note warning">El desglose de lotes no coincide con la existencia registrada. Revise la información; esta vista no ajusta cantidades.</p>}
      <section aria-label="Lotes registrados"><h3>Lotes registrados ({view.lots.length})</h3>{view.lots.length ? <ul className="inventory-lot-list">{view.lots.map((lot, index) => <li key={`${lot.id}-${index}`}><div><small>Lote</small><strong>{lot.lot || "Identificador no registrado"}</strong></div><div><small>{view.legacy ? "Saldo del registro" : "Existencia del lote"}</small><strong>{lot.quantity.toLocaleString("es-CR")} {medicine.unit}</strong></div><div><LotExpiryLabel date={lot.expiresAt} exhausted={lot.quantity <= 0}/></div></li>)}</ul> : <p className="inventory-detail-empty">No hay lotes registrados con existencias.</p>}</section>
      <section className="inventory-last-count" aria-label="Última toma de inventario"><h3>Última toma de inventario</h3>{certification ? <><p>{new Date(certification.createdAt).toLocaleString("es-CR").replace(/\s+/g, " ")}</p><p>Responsable: {certification.pharmacistName}</p><small>Registro histórico; no acredita el saldo actual.</small></> : <p>Sin toma de inventario en los registros consultados.</p>}</section>
      <div className="inventory-detail-actions"><button type="button" className="secondary" onClick={() => onMovement("IN")}><Icon name="plus" size={16}/>Ingreso</button><button type="button" className="secondary" onClick={() => onMovement("OUT")}><Icon name="minus" size={16}/>Egreso</button><button type="button" className="secondary" onClick={onCount}><Icon name="count" size={16}/>Conteo</button><button type="button" className="secondary" onClick={onViewMovements}><Icon name="movements" size={16}/>Ver movimientos</button></div>
    </div>
  </AccessibleDialog>;
}
