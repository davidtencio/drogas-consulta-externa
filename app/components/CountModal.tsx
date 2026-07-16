import { useState, type FormEvent } from "react";
import type { Medicine, Pharmacist } from "../lib/inventory";

type Props = {
  medicine: Medicine | undefined;
  activePharmacists: Pharmacist[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/** Diálogo de conteo físico (arqueo): registra evidencia sin ajustar el stock. */
export function CountModal({ medicine, activePharmacists, busy, onClose, onSubmit }: Props) {
  const [counted, setCounted] = useState("");
  const system = Number(medicine?.stock) || 0;
  const hasValue = counted.trim() !== "" && Number.isFinite(Number(counted));
  const diff = hasValue ? Number(counted) - system : null;
  const diffLabel = diff === null ? "" : diff === 0 ? "Sin diferencia" : diff > 0 ? `Sobrante +${diff}` : `Faltante ${diff}`;
  const diffClass = diff === null || diff === 0 ? "" : diff > 0 ? "pos" : "neg";

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Registrar conteo físico</h2>
        <p>Deja evidencia del arqueo. No modifica las existencias del sistema.</p>
        <form onSubmit={(e) => onSubmit(e, "count")}>
          <label>Medicamento<input value={medicine ? `${medicine.name} ${medicine.strength}` : ""} readOnly /></label>
          <div className="form-row">
            <label>En sistema<input value={`${system.toLocaleString("es-CR")} ${medicine?.unit ?? ""}`} readOnly /></label>
            <label>Contado (físico)<input name="countedQuantity" type="number" min="0" step="1" required value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus /></label>
          </div>
          {diff !== null && <div className={`count-diff ${diffClass}`} role="status">{diffLabel}</div>}
          <label>Nota / justificación<input name="note" placeholder="Opcional: motivo de la diferencia" /></label>
          <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue=""><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
          {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en Configuración para poder continuar.</small>}
          <button className="primary full" disabled={busy || !activePharmacists.length || !medicine}>{busy ? "Guardando..." : "Registrar conteo"}</button>
        </form>
      </div>
    </div>
  );
}
