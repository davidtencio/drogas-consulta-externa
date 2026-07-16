import type { ExpirySummary } from "../lib/inventory";

/** Mensaje del aviso según cuántos hay vencidos y por vencer. */
export function expiryAlertMessage({ expired, soon }: ExpirySummary): string {
  const p = (n: number) => (n > 1 ? "s" : "");
  if (expired > 0 && soon > 0) return `${expired} vencido${p(expired)} y ${soon} por vencer`;
  if (expired > 0) return `${expired} medicamento${p(expired)} vencido${p(expired)}`;
  return `${soon} medicamento${p(soon)} por vencer`;
}

type Props = {
  summary: ExpirySummary;
  showViewButton: boolean;
  onView: () => void;
  onDismiss: () => void;
};

/** Aviso destacado de medicamentos vencidos o por vencer. */
export function ExpiryAlert({ summary, showViewButton, onView, onDismiss }: Props) {
  if (summary.expired <= 0 && summary.soon <= 0) return null;
  const danger = summary.expired > 0;
  return (
    <div className={`expiry-alert${danger ? " danger" : ""}`} role="alert">
      <span className="ico">{danger ? "⚠" : "⏱"}</span>
      <div className="msg">
        <strong>{expiryAlertMessage(summary)}</strong>
        <small>Revise el inventario para gestionarlos a tiempo.</small>
      </div>
      {showViewButton && (
        <button className="alert-action" onClick={onView}>Ver inventario</button>
      )}
      <button className="alert-close" onClick={onDismiss} aria-label="Descartar aviso">×</button>
    </div>
  );
}
