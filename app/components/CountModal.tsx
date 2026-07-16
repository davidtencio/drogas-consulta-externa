import { useState, type FormEvent } from "react";
import type { Medicine, Pharmacist } from "../lib/inventory";

type Props = {
  medicine: Medicine | undefined;
  activePharmacists: Pharmacist[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/**
 * Diálogo de conteo físico por confirmación: se marca una casilla para dejar
 * constancia de que el saldo físico coincide con el sistema. No ingresa
 * cantidades manualmente ni ajusta el stock.
 */
export function CountModal({ medicine, activePharmacists, busy, onClose, onSubmit }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const system = Number(medicine?.stock) || 0;

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2>Confirmar saldo</h2>
        <p>Deja evidencia del arqueo del medicamento. No modifica existencias.</p>
        <form onSubmit={(e) => onSubmit(e, "count")}>
          <label>Medicamento<input value={medicine ? `${medicine.name} ${medicine.strength}` : ""} readOnly /></label>
          <label>En sistema<input value={`${system.toLocaleString("es-CR")} ${medicine?.unit ?? ""}`} readOnly /></label>
          <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo que el saldo físico coincide con el sistema ({system.toLocaleString("es-CR")}).</label>
          <label>Nota / justificación<input name="note" placeholder="Opcional" /></label>
          <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue=""><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
          {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en Configuración para poder continuar.</small>}
          <button className="primary full" disabled={busy || !activePharmacists.length || !medicine || !confirmed}>{busy ? "Guardando..." : "Confirmar saldo"}</button>
        </form>
      </div>
    </div>
  );
}
