import { useState, type FormEvent } from "react";
import type { Medicine, Pharmacist } from "../lib/inventory";
import { AccessibleDialog } from "./AccessibleDialog";
import { useFocusErrorField } from "../hooks/useFocusErrorField";
import { ObservationField } from "./ObservationField";

type Props = {
  medicine: Medicine | undefined; activePharmacists: Pharmacist[]; busy: boolean; error?: string; errorField?: string;
  onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/** Confirma que el saldo físico coincide con el sistema sin ajustar existencias. */
export function CountModal({ medicine, activePharmacists, busy, error, errorField, onClose, onSubmit }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const system = Number(medicine?.stock) || 0;
  useFocusErrorField(errorField, error);

  return (
    <AccessibleDialog title="Confirmar saldo" description="Deja evidencia del arqueo del medicamento. No modifica existencias." onClose={onClose}>
      <form onSubmit={(e) => onSubmit(e, "count")} aria-describedby={error ? "count-error" : undefined}>
        <label>Medicamento<input value={medicine ? `${medicine.name} ${medicine.strength}` : ""} readOnly /></label>
        <label>En sistema<input value={`${system.toLocaleString("es-CR")} ${medicine?.unit ?? ""}`} readOnly /></label>
        <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-autofocus /> Confirmo que el saldo físico coincide con el sistema ({system.toLocaleString("es-CR")}).</label>
        <ObservationField label="Observación del saldo" />
        <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue="" aria-invalid={errorField === "pharmacistEmail" || undefined} aria-describedby={errorField === "pharmacistEmail" ? "count-error" : undefined}><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
        {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en Configuración para poder continuar.</small>}
        {error && <div id="count-error" className="form-error" role="alert">{error}</div>}
        <button className="primary full" disabled={busy || !activePharmacists.length || !medicine || !confirmed}>{busy ? "Guardando..." : "Confirmar saldo"}</button>
      </form>
    </AccessibleDialog>
  );
}
