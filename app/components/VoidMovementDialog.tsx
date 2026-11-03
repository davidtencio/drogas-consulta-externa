import { useState, type FormEvent } from "react";
import type { Movement } from "../lib/inventory";
import { VOID_REASON_MIN_LENGTH } from "../lib/lots";
import { countAfterMovement } from "../lib/movements";
import { AccessibleDialog } from "./AccessibleDialog";
import { CountAfterMovementWarning } from "./CountAfterMovementWarning";

type Props = {
  movement: Movement;
  unit?: string;
  /** Fecha de la última toma de inventario del medicamento, si existe. */
  lastCountAt?: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Confirma la anulación de un egreso que no correspondía. Exige un motivo: el
 * egreso queda en la bitácora marcado como anulado y la cantidad vuelve a sus lotes.
 */
export function VoidMovementDialog({ movement, unit = "", lastCountAt, busy, error, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const countAfter = countAfterMovement(movement, lastCountAt);
  const tooShort = reason.trim().length < VOID_REASON_MIN_LENGTH;
  const blocked = tooShort || (!!countAfter && !acknowledged);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!blocked) onConfirm(reason.trim());
  };
  const lots = movement.lotAllocations?.map((lot) => `${lot.lot}: ${lot.quantity}`).join(" · ");

  return (
    <AccessibleDialog
      title="Anular egreso"
      description="La cantidad se reintegrará a las existencias y a los lotes de los que se descontó. El egreso no se borra: queda en el historial marcado como anulado, con su motivo."
      onClose={onCancel}
      danger
    >
      <form onSubmit={submit} noValidate>
        <div className="observation-context">
          <div><small>Medicamento</small><strong>{movement.medicineName}</strong></div>
          <div><small>Cantidad</small><strong>{movement.quantity.toLocaleString("es-CR")} {unit}</strong></div>
          <div><small>Fecha</small><strong>{new Date(movement.createdAt).toLocaleString("es-CR")}</strong></div>
          <div><small>Prescripción</small><strong>{movement.prescriptionRef || "—"}</strong></div>
          {lots && <div><small>Lotes</small><strong>{lots}</strong></div>}
        </div>
        {countAfter && <CountAfterMovementWarning countAt={countAfter} action="anular" checked={acknowledged} onChange={setAcknowledged} />}
        <label>
          Motivo de la anulación
          <textarea
            name="voidReason"
            rows={3}
            maxLength={500}
            required
            data-autofocus
            aria-invalid={!!error || undefined}
            placeholder="Ej.: receta registrada dos veces; el paciente no retiró el medicamento…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <small className="cell-sub">Mínimo {VOID_REASON_MIN_LENGTH} caracteres.</small>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="danger-action" disabled={busy || blocked}>{busy ? "Procesando…" : "Anular egreso"}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
