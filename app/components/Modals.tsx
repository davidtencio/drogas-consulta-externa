import { useState, type FormEvent } from "react";
import { formatMedicineCode, type Medicine, type Movement, type MovementType, type Pharmacist } from "../lib/inventory";
import { effectiveMedicineForMovementEdit, isLotExpired, normalizeMedicineLots, previewLotOut } from "../lib/lots";
import { AccessibleDialog } from "./AccessibleDialog";
import { useFocusErrorField } from "../hooks/useFocusErrorField";
import { ObservationField } from "./ObservationField";
import { Icon } from "./Icon";
import { FormActions } from "./FormActions";
import { CountAfterMovementWarning } from "./CountAfterMovementWarning";
import { countAfterMovement } from "../lib/movements";

export type ModalState =
  | { kind: "movement"; medicineId?: string; type?: MovementType; editing?: Movement | null }
  | { kind: "medicine"; editing: Medicine | null }
  | { kind: "pharmacist"; editing: Pharmacist | null };

type LotRow = { key: number; lot?: string; expiresAt?: string; quantity?: string };

type Props = {
  state: ModalState; activeMeds: Medicine[]; activePharmacists: Pharmacist[];
  busy: boolean; online: boolean; error?: string; errorField?: string;
  personnelMessage?: string | null;
  /** Última toma de inventario por medicamento (id → fecha ISO), para avisar al editar. */
  lastCountAtByMedicine?: ReadonlyMap<string, string>;
  onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>, action: string) => void;
};

/** Diálogos accesibles de movimiento, medicamento y farmacéutico. */
export function Modals({ state, activeMeds, activePharmacists, busy, online, error, errorField, personnelMessage, lastCountAtByMedicine, onClose, onSubmit }: Props) {
  const em = state.kind === "medicine" ? state.editing : null;
  const ep = state.kind === "pharmacist" ? state.editing : null;
  const editingMovement = state.kind === "movement" ? state.editing ?? null : null;
  const editing = em ?? ep;
  const todayIso = new Date().toISOString();
  const initialMedicineId = state.kind === "movement" ? (editingMovement?.medicineId ?? state.medicineId ?? "") : "";
  const initialMovementType: MovementType = state.kind === "movement"
    ? editingMovement ? (editingMovement.type === "IN" ? "IN" : "OUT") : (state.type ?? "OUT")
    : "OUT";
  const initialMed = activeMeds.find((medicine) => medicine.id === initialMedicineId);
  const initialEffectiveMed = initialMed
    ? effectiveMedicineForMovementEdit(initialMed, editingMovement, todayIso)
    : undefined;
  const initialLots = initialEffectiveMed
    ? normalizeMedicineLots(initialEffectiveMed, initialEffectiveMed.id, todayIso).filter((lot) => lot.quantity > 0)
    : [];
  const initialAllowExpired = Boolean(
    editingMovement?.type === "OUT" &&
      editingMovement.lotAllocations?.some((alloc) => isLotExpired(alloc, editingMovement.createdAt || todayIso))
  );
  const initialTargetLotId = (() => {
    if (editingMovement?.type !== "OUT" || editingMovement.lotAllocations?.length !== 1) return "";
    const singleAlloc = editingMovement.lotAllocations[0];
    const fefoPreview = previewLotOut(initialLots, {
      quantity: editingMovement.quantity,
      now: editingMovement.createdAt || todayIso,
      allowExpired: initialAllowExpired,
    });
    const fefoMatches =
      fefoPreview.allocations.length === 1 &&
      (fefoPreview.allocations[0].lotId === singleAlloc.lotId || fefoPreview.allocations[0].lot === singleAlloc.lot);
    if (fefoMatches) return "";
    const matchedLot = initialLots.find((lot) => lot.id === singleAlloc.lotId || lot.lot === singleAlloc.lot);
    return matchedLot?.id ?? "";
  })();
  const initialLotRows = (): LotRow[] => {
    if (!editingMovement) return [{ key: 1 }];
    if (editingMovement.lotAllocations && editingMovement.lotAllocations.length > 0) {
      return editingMovement.lotAllocations.map((alloc, index) => ({
        key: index + 1,
        lot: alloc.lot,
        expiresAt: alloc.expiresAt,
        quantity: String(alloc.quantity),
      }));
    }
    return [
      {
        key: 1,
        lot: initialMed?.lot || "",
        expiresAt: initialMed?.expiresAt || "",
        quantity: String(editingMovement.quantity),
      },
    ];
  };

  const [code, setCode] = useState(em?.code || "");
  const [movementType, setMovementType] = useState<MovementType>(initialMovementType);
  const [lotRows, setLotRows] = useState<LotRow[]>(initialLotRows);
  const [medicineId, setMedicineId] = useState(initialMedicineId);
  const [outQuantity, setOutQuantity] = useState(editingMovement ? String(editingMovement.quantity) : "");
  const [targetLotId, setTargetLotId] = useState(initialTargetLotId);
  const [allowExpired, setAllowExpired] = useState(initialAllowExpired);
  const [countAcknowledged, setCountAcknowledged] = useState(false);
  const selectedMedicine = activeMeds.find((medicine) => medicine.id === medicineId);
  const effectiveMedicine = selectedMedicine
    ? effectiveMedicineForMovementEdit(selectedMedicine, editingMovement, todayIso)
    : undefined;
  const previewNow = editingMovement && selectedMedicine?.id === editingMovement.medicineId
    ? (editingMovement.createdAt || todayIso)
    : todayIso;
  const normalizedLots = effectiveMedicine
    ? normalizeMedicineLots(effectiveMedicine, effectiveMedicine.id, todayIso).filter((lot) => lot.quantity > 0)
    : [];
  const hasExpiredLots = normalizedLots.some((lot) => isLotExpired(lot, previewNow));
  const outPreview = effectiveMedicine && movementType === "OUT" && Number(outQuantity) > 0
    ? previewLotOut(normalizedLots, {
        quantity: Number(outQuantity),
        now: previewNow,
        targetLotId: targetLotId || undefined,
        allowExpired,
      })
    : null;
  // Al editar, se revierte el movimiento en su medicamento original y se aplica con su
  // fecha original en el destino: cualquiera de las dos tomas posteriores importa.
  const countAfterEdit = editingMovement
    ? [editingMovement.medicineId, medicineId]
        .map((id) => countAfterMovement(editingMovement, id ? lastCountAtByMedicine?.get(id) : undefined))
        .filter((date): date is string => !!date)
        .sort()
        .pop() ?? null
    : null;
  const pharmacistOptions = activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>);
  const title = state.kind === "movement"
    ? editingMovement
      ? movementType === "IN" ? "Editar ingreso" : "Editar egreso"
      : state.type ? movementType === "IN" ? "Registrar ingreso" : "Registrar egreso" : "Registrar movimiento"
    : state.kind === "medicine" ? editing ? "Editar medicamento" : "Agregar medicamento"
    : editing ? "Editar farmacéutico" : "Autorizar farmacéutico";
  const description = state.kind === "movement" ? "Revise el medicamento, los datos de la operación y la persona responsable."
    : state.kind === "medicine" ? editing ? "Las existencias solo cambian mediante movimientos." : "Defina la presentación y niveles de control."
    : "El correo será su identificador de acceso.";
  const errorMessage = error && <div id="modal-error" className="form-error" role="alert">{error}</div>;
  const invalid = (name: string) => errorField === name ? { "aria-invalid": true as const, "aria-describedby": "modal-error" } : {};
  const focusField = state.kind === "movement" && movementType === "IN" && errorField === "quantity" ? "lotQuantity" : errorField;
  useFocusErrorField(focusField, error);

  return (
    <AccessibleDialog title={title} description={description} onClose={onClose} wide={state.kind !== "pharmacist"}>
      {state.kind === "movement" && (
        <form onSubmit={(e) => onSubmit(e, "movement")} aria-busy={busy} aria-describedby={error ? "modal-error" : undefined}>
          <fieldset className="form-section"><legend>1. Medicamento y operación</legend>
          <label>Medicamento<select name="medicineId" required value={medicineId} onChange={(e) => { setMedicineId(e.target.value); setTargetLotId(""); setAllowExpired(false); }} data-autofocus {...invalid("medicineId")}><option value="" disabled>Seleccione…</option>{activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} {m.unit}</option>)}</select></label>
          {selectedMedicine && <p className="form-context">Existencia registrada: <strong>{selectedMedicine.stock.toLocaleString("es-CR")} {selectedMedicine.unit}</strong> · {selectedMedicine.form}{editingMovement && effectiveMedicine && selectedMedicine.id === editingMovement.medicineId ? ` · Saldo previo al movimiento: ${effectiveMedicine.stock.toLocaleString("es-CR")} ${selectedMedicine.unit}` : ""}</p>}
          <div className="form-row">
            <label>Tipo<select name="type" value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)}><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label>
            {movementType === "OUT" && <label>Cantidad<input name="quantity" type="number" min="1" step="1" required value={outQuantity} onChange={(e) => setOutQuantity(e.target.value)} {...invalid("quantity")} /></label>}
          </div>
          {movementType === "OUT" && selectedMedicine && normalizedLots.length > 0 && (
            <>
              <label>
                Lote a descontar
                <select name="targetLotId" value={targetLotId} onChange={(e) => setTargetLotId(e.target.value)} {...invalid("targetLotId")}>
                  <option value="">Automático (FEFO — primero en vencer vigente)</option>
                  {normalizedLots.map((lot) => {
                    const expired = isLotExpired(lot, previewNow);
                    return (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot} ({lot.quantity} {selectedMedicine.unit}) — {lot.expiresAt ? `Vence ${lot.expiresAt}` : "Sin fecha"}{expired ? " · VENCIDO" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              {hasExpiredLots && (
                <label className="confirm-check">
                  <input type="checkbox" name="allowExpired" value="true" checked={allowExpired} onChange={(e) => setAllowExpired(e.target.checked)} />
                  Permitir descargo de lote vencido (baja o retiro de inventario)
                </label>
              )}
              {outPreview && (
                outPreview.error ? (
                  <p className="form-context">{outPreview.error}</p>
                ) : outPreview.allocations.length > 0 ? (
                  <p className="form-context">
                    Descuento previsto ({targetLotId ? "lote seleccionado" : "FEFO"}):{" "}
                    <strong>{outPreview.allocations.map((a) => `${a.lot}: ${a.quantity} ${selectedMedicine.unit}`).join(" · ")}</strong>
                  </p>
                ) : null
              )}
            </>
          )}
          </fieldset>
          {movementType === "IN" && <fieldset className="form-section lot-entry">
            <legend>2. Lotes recibidos</legend>
            <p className="form-context">Registre cada lote por separado. La cantidad del ingreso se calcula con la suma de los lotes.</p>
            {lotRows.map((row, index) => <div className="lot-entry-item" key={row.key}>
              <div className="lot-entry-heading">
                <strong>Lote {index + 1}</strong>
                {lotRows.length > 1 && <button type="button" className="secondary" aria-label={`Quitar lote ${index + 1}`} onClick={() => setLotRows((rows) => rows.filter((item) => item.key !== row.key))}><Icon name="close" size={14} /> Quitar</button>}
              </div>
              <div className="lot-entry-row">
                <label>Lote<input name="lotNumber" required placeholder="Ej. L-2026-01" defaultValue={row.lot} {...invalid("lotNumber")} /></label>
                <label>Expira<input name="lotExpiresAt" type="date" lang="es-CR" required defaultValue={row.expiresAt} {...invalid("lotExpiresAt")} /></label>
                <label>Cantidad<input name="lotQuantity" type="number" min="1" step="1" required defaultValue={row.quantity} {...invalid(errorField === "quantity" ? "quantity" : "lotQuantity")} /></label>
              </div>
            </div>)}
            <button type="button" className="secondary" onClick={() => setLotRows((rows) => [...rows, { key: Math.max(...rows.map((row) => row.key)) + 1 }])}><Icon name="plus" size={14} /> Agregar otro lote</button>
          </fieldset>}
          <fieldset className="form-section"><legend>{movementType === "IN" ? "3" : "2"}. Referencia y responsable</legend>
          {movementType === "OUT" ? <label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481" defaultValue={editingMovement?.prescriptionRef || ""} /></label> : editingMovement?.prescriptionRef ? <input type="hidden" name="prescriptionRef" value={editingMovement.prescriptionRef} /> : null}
          <ObservationField defaultValue={editingMovement?.note || ""} />
          <label>Farmacéutico responsable<select name="pharmacistEmail" required defaultValue={editingMovement?.pharmacistEmail || ""} {...invalid("pharmacistEmail")}><option value="" disabled>Seleccione…</option>{pharmacistOptions}</select></label>
          </fieldset>
          {countAfterEdit && <CountAfterMovementWarning countAt={countAfterEdit} action="editar" name="confirmAfterCount" checked={countAcknowledged} onChange={setCountAcknowledged} />}
          {!activePharmacists.length && <small className="form-hint" role="status">{personnelMessage ?? "Registre un farmacéutico autorizado en Configuración para poder continuar."}</small>}
          {!online && <small className="form-hint">Sin conexión: el registro de movimientos requiere conexión. Se habilitará al reconectar.</small>}
          {errorMessage}
          <FormActions busy={busy} disabled={!activePharmacists.length || !online || (!!countAfterEdit && !countAcknowledged)} label={editingMovement ? "Guardar cambios" : "Confirmar movimiento"} onCancel={onClose} />
        </form>
      )}

      {state.kind === "medicine" && (
        <form onSubmit={(e) => onSubmit(e, "medicine")} aria-busy={busy} aria-describedby={error ? "modal-error" : undefined}>
          <fieldset className="form-section"><legend>Identificación de la presentación</legend>
          <div className="form-row">
            <label>Nombre<input name="name" required placeholder="Ej. Metformina" defaultValue={em?.name || ""} data-autofocus {...invalid("name")} /></label>
            <label>Código<input name="code" inputMode="numeric" placeholder="000-00-0000" value={code} onChange={(e) => setCode(formatMedicineCode(e.target.value))} {...invalid("code")} /></label>
          </div>
          <div className="form-row">
            <label>Concentración<input name="strength" required placeholder="500 mg" defaultValue={em?.strength || ""} {...invalid("strength")} /></label>
            <label>Forma<input name="form" placeholder="Tableta" defaultValue={em?.form || ""} /></label>
          </div>
          </fieldset>
          <fieldset className="form-section"><legend>Control de existencias</legend>
          <div className="form-row">
            {!editing && <label>Existencia inicial<input name="stock" type="number" min="0" step="1" defaultValue="0" {...invalid("stock")} /></label>}
            <label>Stock mínimo<input name="minimumStock" type="number" min="0" step="1" defaultValue={em ? String(em.minimumStock) : "0"} /></label>
          </div>
          <div className="form-row">
            <label>Lote<input name="lot" defaultValue={em?.lot || ""} readOnly={Boolean(em?.lots?.length)} {...invalid("lot")} /></label>
            <label>Vencimiento<input name="expiresAt" type="date" lang="es-CR" defaultValue={em?.expiresAt || ""} readOnly={Boolean(em?.lots?.length)} {...invalid("expiresAt")} /></label>
          </div>
          {Boolean(em?.lots?.length) && <small className="form-hint">El lote y vencimiento principales se actualizan automáticamente a partir de los lotes activos (FEFO).</small>}
          {!editing && <label>Farmacéutico responsable<small className="inline-hint">Requerido si la existencia inicial es mayor a 0</small><select name="pharmacistEmail" defaultValue=""><option value="">Sin ingreso inicial</option>{pharmacistOptions}</select></label>}
          </fieldset>
          {errorMessage}
          <FormActions busy={busy} label={editing ? "Guardar cambios" : "Guardar medicamento"} onCancel={onClose} />
        </form>
      )}

      {state.kind === "pharmacist" && (
        <form onSubmit={(e) => onSubmit(e, "pharmacist")} aria-busy={busy} aria-describedby={error ? "modal-error" : undefined}>
          <label>Nombre completo<input name="name" required defaultValue={ep?.name || ""} data-autofocus {...invalid("name")} /></label>
          <label>Correo institucional<input name="email" type="email" required defaultValue={ep?.email || ""} {...invalid("email")} /></label>
          <label>Código profesional<input name="license" required placeholder="Ej. CF-1234" defaultValue={ep?.license || ""} {...invalid("license")} /></label>
          {errorMessage}
          <FormActions busy={busy} label={editing ? "Guardar cambios" : "Autorizar usuario"} onCancel={onClose} />
        </form>
      )}
    </AccessibleDialog>
  );
}
