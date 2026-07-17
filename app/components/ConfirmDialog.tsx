import { AccessibleDialog } from "./AccessibleDialog";

type Props = { label: string; busy: boolean; onCancel: () => void; onConfirm: () => void };

/** Confirmación contextual y reversible para desactivar un registro. */
export function ConfirmDialog({ label, busy, onCancel, onConfirm }: Props) {
  return (
    <AccessibleDialog title="Confirmar baja" description={`Se desactivará “${label}”. Podrá reactivarlo posteriormente desde Configuración.`} onClose={onCancel} danger>
      <div className="dialog-actions">
        <button type="button" className="secondary" onClick={onCancel} data-autofocus>Cancelar</button>
        <button type="button" className="danger-action" onClick={onConfirm} disabled={busy}>{busy ? "Procesando…" : "Dar de baja"}</button>
      </div>
    </AccessibleDialog>
  );
}
