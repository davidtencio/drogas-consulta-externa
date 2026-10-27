type Props = { busy: boolean; disabled?: boolean; label: string; onCancel: () => void };

/** Acciones consistentes; cancelar no envía el formulario. */
export function FormActions({ busy, disabled = false, label, onCancel }: Props) {
  return <div className="form-actions">
    <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
    <button type="submit" className="primary" disabled={busy || disabled}>{busy ? "Guardando…" : label}</button>
  </div>;
}
