import { expiryStatus, type Medicine, type MovementType, type Pharmacist } from "../lib/inventory";
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
};

/** Pestaña de Configuración: catálogo de medicamentos y farmacéuticos autorizados. */
export function SettingsTab({ medicines, pharmacists, onCreate, onEdit, onSetActive, onMovement, onCount, auditLogs = [] }: Props) {
  return (
    <div className="settings-grid">
      <div className="panel">
        <div className="panel-title">
          <div><h2>Medicamentos</h2><p>Catálogo del inventario.</p></div>
          <button className="secondary" onClick={() => onCreate("medicine")}>＋ Agregar</button>
        </div>
        {medicines.length ? medicines.map((m) => {
          const exp = expiryStatus(m.expiresAt);
          return (
            <div className={`list-row${m.active === false ? " inactive" : ""}`} key={m.id}>
              <span className="mini-icon">✚</span>
              <div><strong>{m.name}</strong><small>{m.strength} · {m.form}{m.code ? ` · ${m.code}` : ""}</small></div>
              {exp === "vencido" && <span className="badge expired">Vencido</span>}
              {exp === "por-vencer" && <span className="badge soon">Vence pronto</span>}
              <span className={`tag${m.active === false ? " off" : ""}`}>{m.active === false ? "Inactivo" : "Activo"}</span>
              <div className="row-actions">
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
        }) : <div className="empty-block">Registre el primer medicamento del catálogo.</div>}
      </div>
      <div className="panel">
        <div className="panel-title">
          <div><h2>Farmacéuticos autorizados</h2><p>Usuarios habilitados para operar.</p></div>
          <button className="secondary" onClick={() => onCreate("pharmacist")}>＋ Agregar</button>
        </div>
        {pharmacists.length ? pharmacists.map((p) => (
          <div className={`list-row${p.active === false ? " inactive" : ""}`} key={p.id}>
            <span className="mini-icon person">{p.name.slice(0, 2).toUpperCase()}</span>
            <div><strong>{p.name}</strong><small>{p.email} · {p.license}</small></div>
            <span className={`tag${p.active === false ? " off" : ""}`}>{p.active === false ? "Inactivo" : "Activo"}</span>
            <div className="row-actions">
              <button onClick={() => onEdit("pharmacist", p)}>Editar</button>
              {p.active === false
                ? <button onClick={() => onSetActive("pharmacists", p.id, true, p.name)}>Reactivar</button>
                : <button className="danger" onClick={() => onSetActive("pharmacists", p.id, false, p.name)}>Dar de baja</button>}
            </div>
          </div>
        )) : <div className="empty-block">Registre al primer farmacéutico autorizado.</div>}
      </div>
      <div className="panel audit-panel">
        <div className="panel-title"><div><h2>Bitácora administrativa</h2><p>Últimos cambios de catálogo y autorizaciones. Los registros no se pueden editar ni eliminar.</p></div></div>
        {auditLogs.length ? auditLogs.map((entry) => <div className="list-row audit-row" key={entry.id}><span className="mini-icon">⌁</span><div><strong>{entry.action}</strong><small>{entry.entityType} · {entry.entityId}</small></div><div className="audit-who"><strong>{entry.actorEmail}</strong><small>{new Date(entry.createdAt).toLocaleString("es-CR")}</small></div></div>) : <div className="empty-block">Aún no hay cambios administrativos registrados.</div>}
      </div>
    </div>
  );
}
