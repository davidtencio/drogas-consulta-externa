import { useState } from "react";
import { type Medicine, type MovementType, type Pharmacist } from "../lib/inventory";
import { Icon } from "./Icon";
import { inventoryLotView } from "../lib/inventoryView";
import type { AuditLog } from "../lib/authz";

type Props = {
  medicines: Medicine[];
  pharmacists: Pharmacist[];
  onCreate: (kind: "medicine" | "pharmacist") => void;
  onEdit: (kind: "medicine" | "pharmacist", item: Medicine | Pharmacist) => void;
  onSetActive: (col: "medicines" | "pharmacists", id: string, active: boolean, label: string) => void;
  onMovement: (medicineId: string, type: MovementType) => void;
  onCount: (medicineId: string) => void;
  auditLogs?: AuditLog[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

/** Pestaña de Configuración: catálogo de medicamentos y farmacéuticos autorizados. */
export function SettingsTab({ medicines, pharmacists, onCreate, onEdit, onSetActive, onMovement, onCount, auditLogs = [], loading = false, error, onRetry }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("all");
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = (active: boolean | undefined, value: string) => (status === "all" || (active !== false ? "active" : "inactive") === status) && normalized(value).includes(normalized(text.trim()));
  const shownMedicines = medicines.filter((m) => matches(m.active, `${m.name} ${m.strength} ${m.code ?? ""}`));
  const shownPharmacists = pharmacists.filter((p) => matches(p.active, `${p.name} ${p.email} ${p.license}`));
  if (error) return <div className="panel empty-block" role="alert"><p>{error}</p><button className="secondary" onClick={onRetry}>Reintentar</button></div>;
  if (loading) return <div className="panel empty-block" role="status">Cargando catálogo y personal…</div>;
  return (
    <div className="settings-grid">
      <div className="settings-toolbar">
        <label>Buscar en configuración<input type="search" placeholder="Nombre, código, correo o código profesional" value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label>Estado del registro<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label>
        {(text || status !== "all") && <button className="secondary" onClick={() => { setText(""); setStatus("all"); }}>Limpiar filtros</button>}
      </div>
      <div className="panel">
        <div className="panel-title">
          <div><h2>Medicamentos</h2><p>{shownMedicines.length} de {medicines.length} presentaciones · la baja conserva el historial.</p></div>
          <button className="secondary" onClick={() => onCreate("medicine")}><Icon name="plus" size={15} /> Agregar</button>
        </div>
        {shownMedicines.length ? shownMedicines.map((m) => {
          const lots = inventoryLotView(m);
          return (
            <div className={`list-row${m.active === false ? " inactive" : ""}`} key={m.id}>
              <span className="mini-icon"><Icon name="pill" size={17} /></span>
              <div className="record-identity"><strong>{m.name}</strong><small>{m.strength} · {m.form}{m.code ? ` · ${m.code}` : ""}</small><small>Existencia registrada: {m.stock.toLocaleString("es-CR")} {m.unit} · Mínimo {m.minimumStock}</small>{lots.expired && <span className="inventory-expiry-state danger"><Icon name="alert" size={13} /> Con lotes vencidos</span>}{lots.soon && <span className="inventory-expiry-state warning"><Icon name="clock" size={13} /> Con lotes por vencer</span>}</div>
              <span className={`tag${m.active === false ? " off" : ""}`}>{m.active === false ? "Inactivo" : "Activo"}</span>
              <div className="row-actions" role="group" aria-label={`Acciones de ${m.name} ${m.strength}`}>
                {m.active !== false && <>
                  <button onClick={() => onMovement(m.id, "IN")}>Ingreso</button>
                  <button onClick={() => onMovement(m.id, "OUT")}>Egreso</button>
                  <button onClick={() => onCount(m.id)}>Conteo</button>
                </>}
                <button onClick={() => onEdit("medicine", m)}>Editar</button>
                {m.active === false
                  ? <button onClick={() => onSetActive("medicines", m.id, true, m.name)}>Reactivar</button>
                  : <button className="danger" onClick={() => onSetActive("medicines", m.id, false, m.name)}>Dar de baja</button>}
              </div>
            </div>
          );
        }) : <div className="empty-block">{medicines.length ? "Ningún medicamento coincide con los filtros." : "Registre el primer medicamento del catálogo."}</div>}
      </div>
      <div className="panel">
        <div className="panel-title">
          <div><h2>Farmacéuticos autorizados</h2><p>{shownPharmacists.length} de {pharmacists.length} registros · responsables de las operaciones.</p></div>
          <button className="secondary" onClick={() => onCreate("pharmacist")}><Icon name="plus" size={15} /> Agregar</button>
        </div>
        {shownPharmacists.length ? shownPharmacists.map((p) => (
          <div className={`list-row${p.active === false ? " inactive" : ""}`} key={p.id}>
            <span className="mini-icon person">{p.name.slice(0, 2).toUpperCase()}</span>
            <div className="record-identity"><strong>{p.name}</strong><small>{p.email} · {p.license}</small></div>
            <span className={`tag${p.active === false ? " off" : ""}`}>{p.active === false ? "Inactivo" : "Activo"}</span>
            <div className="row-actions" role="group" aria-label={`Acciones de ${p.name}`}>
              <button onClick={() => onEdit("pharmacist", p)}>Editar</button>
              {p.active === false
                ? <button onClick={() => onSetActive("pharmacists", p.id, true, p.name)}>Reactivar</button>
                : <button className="danger" onClick={() => onSetActive("pharmacists", p.id, false, p.name)}>Dar de baja</button>}
            </div>
          </div>
        )) : <div className="empty-block">{pharmacists.length ? "Ningún farmacéutico coincide con los filtros." : "Registre al primer farmacéutico autorizado."}</div>}
      </div>
      <div className="panel audit-panel">
        <div className="panel-title"><div><h2>Bitácora administrativa</h2><p>Últimos cambios de catálogo y autorizaciones. Los registros no se pueden editar ni eliminar.</p></div></div>
        {auditLogs.length ? auditLogs.map((entry) => <div className="list-row audit-row" key={entry.id}><span className="mini-icon"><Icon name="audit" size={16} /></span><div><strong>{entry.action}</strong><small>{entry.entityType} · {entry.entityId}</small></div><div className="audit-who"><strong>{entry.actorEmail}</strong><small>{new Date(entry.createdAt).toLocaleString("es-CR")}</small></div></div>) : <div className="empty-block">Aún no hay cambios administrativos registrados.</div>}
      </div>
    </div>
  );
}
