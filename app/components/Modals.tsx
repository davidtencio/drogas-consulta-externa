import { useState, type FormEvent } from "react";
import { formatMedicineCode, type Medicine, type MovementType, type Pharmacist } from "../lib/inventory";
import { AccessibleDialog } from "./AccessibleDialog";
import { useFocusErrorField } from "../hooks/useFocusErrorField";
import { ObservationField } from "./ObservationField";
import { Icon } from "./Icon";

export type ModalState =
  | { kind: "movement"; medicineId?: string; type?: MovementType }
  | { kind: "medicine"; editing: Medicine | null }
  | { kind: "pharmacist"; editing: Pharmacist | null };

type Props = {
  state: ModalState; activeMeds: Medicine[]; activePharmacists: Pharmacist[];
  busy: boolean; online: boolean; error?: string; errorField?: string;
  onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/** Diálogos accesibles de movimiento, medicamento y farmacéutico. */
export function Modals({ state, activeMeds, activePharmacists, busy, online, error, errorField, onClose, onSubmit }: Props) {
  const em = state.kind === "medicine" ? state.editing : null;
  const ep = state.kind === "pharmacist" ? state.editing : null;
  const editing = em ?? ep;
  const [code, setCode] = useState(em?.code || "");
  const [movementType, setMovementType] = useState<MovementType>(state.kind === "movement" ? state.type ?? "OUT" : "OUT");
  const [lotRows, setLotRows] = useState([{ key: 1 }]);
  const pharmacistOptions = activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>);
  const title = state.kind === "movement"
    ? state.type === "IN" ? "Registrar ingreso" : state.type === "OUT" ? "Registrar egreso" : "Registrar movimiento"
    : state.kind === "medicine" ? editing ? "Editar medicamento" : "Agregar medicamento"
    : editing ? "Editar farmacéutico" : "Autorizar farmacéutico";
  const description = state.kind === "movement" ? "Actualice existencias con trazabilidad completa."
    : state.kind === "medicine" ? editing ? "Las existencias solo cambian mediante movimientos." : "Defina la presentación y niveles de control."
    : "El correo será su identificador de acceso.";
  const errorMessage = error && <div id="modal-error" className="form-error" role="alert">{error}</div>;
  const invalid = (name: string) => errorField === name ? { "aria-invalid": true as const, "aria-describedby": "modal-error" } : {};
  useFocusErrorField(errorField, error);

  return (
    <AccessibleDialog title={title} description={description} onClose={onClose}>
      {state.kind === "movement" && (
        <form onSubmit={(e) => onSubmit(e, "movement")} aria-describedby={error ? "modal-error" : undefined}>
          <label>Medicamento<select name="medicineId" required defaultValue={state.medicineId ?? ""} data-autofocus {...invalid("medicineId")}>{state.medicineId ? null : <option value="" disabled>Seleccione…</option>}{activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} disp.</option>)}</select></label>
          <div className="form-row">
            <label>Tipo<select name="type" value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)}><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label>
            {movementType === "OUT" && <label>Cantidad<input name="quantity" type="number" min="1" step="1" required {...invalid("quantity")} /></label>}
          </div>
          {movementType === "IN" && <fieldset className="lot-entry"><legend>Lotes recibidos</legend>{lotRows.map((row, index) => <div className="lot-entry-row" key={row.key}><label>Lote<input name="lotNumber" required placeholder="Ej. L-2026-01" /></label><label>Expira<input name="lotExpiresAt" type="date" lang="es-CR" required /></label><label>Cantidad<input name="lotQuantity" type="number" min="1" step="1" required /></label>{lotRows.length > 1 && <button type="button" aria-label={`Quitar lote ${index + 1}`} onClick={() => setLotRows((rows) => rows.filter((item) => item.key !== row.key))}><Icon name="close" size={14} /></button>}</div>)}<button type="button" className="observation-toggle" onClick={() => setLotRows((rows) => [...rows, { key: Math.max(...rows.map((row) => row.key)) + 1 }])}><Icon name="plus" size={14} /> Agregar otro lote</button></fieldset>}
          {movementType === "OUT" && <label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481" /></label>}
          <ObservationField />
          <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue="" {...invalid("pharmacistEmail")}><option value="" disabled>Seleccione…</option>{pharmacistOptions}</select></label>
          {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en Configuración para poder continuar.</small>}
          {!online && <small className="form-hint">Sin conexión: el registro de movimientos requiere conexión. Se habilitará al reconectar.</small>}
          {errorMessage}
          <button className="primary full" disabled={busy || !activePharmacists.length || !online}>{busy ? "Guardando..." : "Confirmar movimiento"}</button>
        </form>
      )}

      {state.kind === "medicine" && (
        <form onSubmit={(e) => onSubmit(e, "medicine")} aria-describedby={error ? "modal-error" : undefined}>
          <div className="form-row">
            <label>Nombre<input name="name" required placeholder="Ej. Metformina" defaultValue={em?.name || ""} data-autofocus {...invalid("name")} /></label>
            <label>Código<input name="code" inputMode="numeric" placeholder="000-00-0000" value={code} onChange={(e) => setCode(formatMedicineCode(e.target.value))} {...invalid("code")} /></label>
          </div>
          <div className="form-row">
            <label>Concentración<input name="strength" required placeholder="500 mg" defaultValue={em?.strength || ""} {...invalid("strength")} /></label>
            <label>Forma<input name="form" placeholder="Tableta" defaultValue={em?.form || ""} /></label>
          </div>
          <div className="form-row">
            {!editing && <label>Existencia inicial<input name="stock" type="number" min="0" step="1" defaultValue="0" {...invalid("stock")} /></label>}
            <label>Stock mínimo<input name="minimumStock" type="number" min="0" step="1" defaultValue={em ? String(em.minimumStock) : "0"} /></label>
          </div>
          <div className="form-row">
            <label>Lote<input name="lot" defaultValue={em?.lot || ""} /></label>
            <label>Vencimiento<input name="expiresAt" type="date" lang="es-CR" defaultValue={em?.expiresAt || ""} /></label>
          </div>
          {!editing && <label>Farmacéutico responsable<small className="inline-hint">Requerido si la existencia inicial es mayor a 0</small><select name="pharmacistEmail" defaultValue=""><option value="">Sin ingreso inicial</option>{pharmacistOptions}</select></label>}
          {errorMessage}
          <button className="primary full" disabled={busy}>{busy ? "Guardando..." : editing ? "Guardar cambios" : "Guardar medicamento"}</button>
        </form>
      )}

      {state.kind === "pharmacist" && (
        <form onSubmit={(e) => onSubmit(e, "pharmacist")} aria-describedby={error ? "modal-error" : undefined}>
          <label>Nombre completo<input name="name" required defaultValue={ep?.name || ""} data-autofocus /></label>
          <label>Correo institucional<input name="email" type="email" required defaultValue={ep?.email || ""} /></label>
          <label>Código profesional<input name="license" required placeholder="Ej. CF-1234" defaultValue={ep?.license || ""} /></label>
          {errorMessage}
          <button className="primary full" disabled={busy}>{busy ? "Guardando..." : editing ? "Guardar cambios" : "Autorizar usuario"}</button>
        </form>
      )}
    </AccessibleDialog>
  );
}
