import { daysUntilExpiry, expiryStatus, isLowStock, type Medicine } from "../lib/inventory";
import { inventoryDateLabel, inventoryLotView } from "../lib/inventoryView";
import { Icon } from "./Icon";

export function StockLabel({ medicine }: { medicine: Medicine }) {
  const low = isLowStock(medicine);
  return <div><span className={`inventory-stock-state${low ? " warning" : ""}`}><Icon name={low ? "alert" : "check"} size={14}/>{medicine.stock === 0 ? "Sin existencias" : low ? medicine.stock === medicine.minimumStock ? "En el mínimo" : "Stock bajo" : "Sobre el mínimo"}</span><small className="inventory-minimum">Mínimo: {medicine.minimumStock.toLocaleString("es-CR")} {medicine.unit}</small></div>;
}

export function LotExpiryLabel({ date, exhausted = false }: { date: string; exhausted?: boolean }) {
  const status = expiryStatus(date);
  const days = daysUntilExpiry(date);
  const tone = exhausted ? "" : status === "vencido" ? " danger" : status === "por-vencer" || status === "sin-fecha" ? " warning" : "";
  const label = exhausted ? "Lote sin saldo · excluido de alertas" : status === "vencido" ? "Lote vencido" : status === "por-vencer" ? days === 0 ? "Vence hoy" : `Vence en ${days} días` : status === "sin-fecha" ? "Revisar información del lote" : "Sin alerta de fecha";
  return <><span className="inventory-expiry-date">{inventoryDateLabel(date)}</span><span className={`inventory-expiry-state${tone}`}>{!exhausted && (status === "vencido" || status === "por-vencer") && <Icon name={status === "vencido" ? "alert" : "clock"} size={13}/>} {label}</span></>;
}

export function MedicineExpiryLabel({ medicine }: { medicine: Medicine }) {
  const view = inventoryLotView(medicine);
  if (!view.positive.length) return <><span className="inventory-expiry-date">Sin lotes con saldo</span><span className="inventory-expiry-state">Sin vencimiento que mostrar</span></>;
  return <><LotExpiryLabel date={view.nearest}/>{view.expired && view.soon && <span className="inventory-expiry-state warning">También hay lotes por vencer</span>}{view.nearest && view.unknown && <span className="inventory-expiry-state warning">Hay lotes sin fecha registrada</span>}{view.mismatch && <span className="inventory-expiry-state warning">Revisar desglose de existencias</span>}</>;
}
