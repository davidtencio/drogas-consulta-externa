import type { Movement, MovementSnapshot } from "../lib/inventory";
import { AccessibleDialog } from "./AccessibleDialog";

type Props = {
  movement: Movement;
  unit: string;
  resolveName: (email: string) => string;
  onClose: () => void;
};

const typeLabel = (type: Movement["type"]) => (type === "IN" ? "Ingreso" : type === "OUT" ? "Egreso" : "Conteo");

function VersionDetails({ version, unit, resolveName }: { version: MovementSnapshot; unit: string; resolveName: (email: string) => string }) {
  const lots = version.lotAllocations?.map((lot) => `${lot.lot}: ${lot.quantity}`).join(" · ");
  return (
    <dl className="history-details">
      <div><dt>Medicamento</dt><dd>{version.medicineName}</dd></div>
      <div><dt>Operación</dt><dd>{typeLabel(version.type)}</dd></div>
      <div><dt>Cantidad</dt><dd>{version.quantity.toLocaleString("es-CR")} {unit}</dd></div>
      {lots && <div><dt>Lotes</dt><dd>{lots}</dd></div>}
      <div><dt>Prescripción</dt><dd>{version.prescriptionRef || "—"}</dd></div>
      <div><dt>Responsable</dt><dd>{resolveName(version.pharmacistEmail)}</dd></div>
      {version.note && <div><dt>Observación</dt><dd>{version.note}</dd></div>}
    </dl>
  );
}

/** Muestra la versión vigente de un movimiento y, debajo, cada versión anterior a sus ediciones. */
export function MovementHistoryDialog({ movement, unit, resolveName, onClose }: Props) {
  const history = movement.editHistory ?? [];
  return (
    <AccessibleDialog title="Historial de ediciones" description={`Cada edición conserva cómo estaba el movimiento antes del cambio. Registrado el ${new Date(movement.createdAt).toLocaleString("es-CR")}`} onClose={onClose} wide>
      <ol className="history-list">
        <li>
          <h3>Versión vigente</h3>
          <VersionDetails version={movement} unit={unit} resolveName={resolveName} />
        </li>
        {[...history].reverse().map((entry, index) => (
          <li key={`${entry.editedAt}-${index}`}>
            <h3>Antes de la edición del {new Date(entry.editedAt).toLocaleString("es-CR")}</h3>
            <p className="cell-sub">Editado por {resolveName(entry.editedByEmail)}</p>
            <VersionDetails version={entry.previous} unit={unit} resolveName={resolveName} />
          </li>
        ))}
      </ol>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose} data-autofocus>Cerrar</button></div>
    </AccessibleDialog>
  );
}
