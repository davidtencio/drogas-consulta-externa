import { useState, type FormEvent } from "react";
import type { Medicine, MovementType, Pharmacist } from "../lib/inventory";
import { AccessibleDialog } from "./AccessibleDialog";
import { useFocusErrorField } from "../hooks/useFocusErrorField";
import { ObservationField } from "./ObservationField";
import { FormActions } from "./FormActions";

type Props = {
  medicine: Medicine | undefined; activePharmacists: Pharmacist[]; busy: boolean; error?: string; errorField?: string;
  personnelMessage?: string | null;
  onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
  onAdjust?: (medicineId: string, type: MovementType) => void;
};

/** Confirma que el saldo físico coincide con el sistema sin ajustar existencias, o permite conciliar una diferencia. */
export function CountModal({ medicine, activePharmacists, busy, error, errorField, personnelMessage, onClose, onSubmit, onAdjust }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const system = Number(medicine?.stock) || 0;
  const [countedQuantity, setCountedQuantity] = useState(String(system));
  const parsedCount = countedQuantity.trim() === "" ? system : Number(countedQuantity);
  const diff = Number.isInteger(parsedCount) && parsedCount >= 0 ? parsedCount - system : 0;
  useFocusErrorField(errorField, error);

  return (
    <AccessibleDialog title="Confirmar saldo" description="Deja evidencia de la toma de inventario del medicamento. No modifica existencias." onClose={onClose}>
      <form onSubmit={(e) => onSubmit(e, "count")} aria-busy={busy} aria-describedby={error ? "count-error" : undefined}>
        <div className="form-row form-summary">
          <label>Medicamento<input value={medicine ? `${medicine.name} ${medicine.strength}` : ""} readOnly /></label>
          <label>En sistema<input value={`${system.toLocaleString("es-CR")} ${medicine?.unit ?? ""}`} readOnly /></label>
        </div>
        <label>
          Cantidad física contada
          <input
            name="countedQuantity"
            type="number"
            min="0"
            step="1"
            value={countedQuantity}
            onChange={(e) => setCountedQuantity(e.target.value)}
            aria-invalid={errorField === "countedQuantity" || undefined}
            aria-describedby={errorField === "countedQuantity" ? "count-error" : undefined}
          />
        </label>
        {diff !== 0 && (
          <p className="form-context">
            Diferencia frente al sistema: <strong>{diff > 0 ? `+${diff}` : diff} {medicine?.unit ?? ""}</strong> (el conteo deja constancia en bitácora sin alterar el stock).
          </p>
        )}
        <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-autofocus /> Confirmo el conteo físico verificado ({(Number.isInteger(parsedCount) && parsedCount >= 0 ? parsedCount : system).toLocaleString("es-CR")}).</label>
        {medicine && onAdjust && (
          <div className="form-row">
            <button type="button" className="secondary" onClick={() => onAdjust(medicine.id, "OUT")}>Registrar faltante (egreso)</button>
            <button type="button" className="secondary" onClick={() => onAdjust(medicine.id, "IN")}>Registrar sobrante (ingreso)</button>
          </div>
        )}
        <ObservationField label="Observación del saldo" />
        <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue="" aria-invalid={errorField === "pharmacistEmail" || undefined} aria-describedby={errorField === "pharmacistEmail" ? "count-error" : undefined}><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
        {!activePharmacists.length && <small className="form-hint" role="status">{personnelMessage ?? "Registre un farmacéutico autorizado en Configuración para poder continuar."}</small>}
        {error && <div id="count-error" className="form-error" role="alert">{error}</div>}
        <FormActions busy={busy} disabled={!activePharmacists.length || !medicine || !confirmed} label="Confirmar saldo" onCancel={onClose} />
      </form>
    </AccessibleDialog>
  );
}
