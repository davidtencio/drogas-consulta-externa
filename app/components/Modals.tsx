import type { FormEvent } from "react";
import type { Medicine, MovementType, Pharmacist } from "../lib/inventory";

/** Estado del diálogo abierto (unión discriminada, sin casts). */
export type ModalState =
  | { kind: "movement"; medicineId?: string; type?: MovementType }
  | { kind: "medicine"; editing: Medicine | null }
  | { kind: "pharmacist"; editing: Pharmacist | null };

type Props = {
  state: ModalState;
  activeMeds: Medicine[];
  activePharmacists: Pharmacist[];
  busy: boolean;
  online: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/** Diálogos de registro/edición de movimiento, medicamento y farmacéutico. */
export function Modals({ state, activeMeds, activePharmacists, busy, online, onClose, onSubmit }: Props) {
  const em = state.kind === "medicine" ? state.editing : null;
  const ep = state.kind === "pharmacist" ? state.editing : null;
  const editing = em ?? ep;
  const pharmacistOptions = activePharmacists.map((p) => (
    <option key={p.id} value={p.email}>{p.name} — {p.license}</option>
  ));

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Cerrar">×</button>

        {state.kind === "movement" && <>
          <h2>{state.type === "IN" ? "Registrar ingreso" : state.type === "OUT" ? "Registrar egreso" : "Registrar movimiento"}</h2>
          <p>Actualice existencias con trazabilidad completa.</p>
          <form onSubmit={(e) => onSubmit(e, "movement")}>
            <label>Medicamento<select name="medicineId" required defaultValue={state.medicineId ?? ""}>{state.medicineId ? null : <option value="" disabled>Seleccione…</option>}{activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} disp.</option>)}</select></label>
            <div className="form-row">
              <label>Tipo<select name="type" defaultValue={state.type ?? "OUT"}><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label>
              <label>Cantidad<input name="quantity" type="number" min="1" required /></label>
            </div>
            <label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481" /></label>
            <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue=""><option value="" disabled>Seleccione…</option>{pharmacistOptions}</select></label>
            {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en Configuración para poder continuar.</small>}
            {!online && <small className="form-hint">Sin conexión: el registro de movimientos requiere conexión. Se habilitará al reconectar.</small>}
            <button className="primary full" disabled={busy || !activePharmacists.length || !online}>{busy ? "Guardando..." : "Confirmar movimiento"}</button>
          </form>
        </>}

        {state.kind === "medicine" && <>
          <h2>{editing ? "Editar medicamento" : "Agregar medicamento"}</h2>
          <p>{editing ? "Las existencias solo cambian mediante movimientos." : "Defina la presentación y niveles de control."}</p>
          <form onSubmit={(e) => onSubmit(e, "medicine")}>
            <label>Nombre<input name="name" required placeholder="Ej. Metformina" defaultValue={em?.name || ""} /></label>
            <div className="form-row">
              <label>Concentración<input name="strength" required placeholder="500 mg" defaultValue={em?.strength || ""} /></label>
              <label>Forma<input name="form" placeholder="Tableta" defaultValue={em?.form || ""} /></label>
            </div>
            <div className="form-row">
              {!editing && <label>Existencia inicial<input name="stock" type="number" min="0" defaultValue="0" /></label>}
              <label>Stock mínimo<input name="minimumStock" type="number" min="0" defaultValue={em ? String(em.minimumStock) : "0"} /></label>
            </div>
            <div className="form-row">
              <label>Lote<input name="lot" defaultValue={em?.lot || ""} /></label>
              <label>Vencimiento<input name="expiresAt" type="date" defaultValue={em?.expiresAt || ""} /></label>
            </div>
            {!editing && <label>Farmacéutico responsable<small className="inline-hint">Requerido si la existencia inicial es mayor a 0</small><select name="pharmacistEmail" defaultValue=""><option value="">Sin ingreso inicial</option>{pharmacistOptions}</select></label>}
            <button className="primary full" disabled={busy}>{busy ? "Guardando..." : editing ? "Guardar cambios" : "Guardar medicamento"}</button>
          </form>
        </>}

        {state.kind === "pharmacist" && <>
          <h2>{editing ? "Editar farmacéutico" : "Autorizar farmacéutico"}</h2>
          <p>El correo será su identificador de acceso.</p>
          <form onSubmit={(e) => onSubmit(e, "pharmacist")}>
            <label>Nombre completo<input name="name" required defaultValue={ep?.name || ""} /></label>
            <label>Correo institucional<input name="email" type="email" required defaultValue={ep?.email || ""} /></label>
            <label>Código profesional<input name="license" required placeholder="Ej. CF-1234" defaultValue={ep?.license || ""} /></label>
            <button className="primary full" disabled={busy}>{busy ? "Guardando..." : editing ? "Guardar cambios" : "Autorizar usuario"}</button>
          </form>
        </>}
      </div>
    </div>
  );
}
