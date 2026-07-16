export type Tab = "dashboard" | "movements" | "settings";

type Props = {
  email: string;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onSignOut: () => void;
};

/** Barra lateral: navegación entre pestañas y perfil de la sesión. */
export function Sidebar({ email, tab, onTab, onSignOut }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">Rx</span>
        <div><strong>Control de Drogas</strong><small>Consulta externa</small></div>
      </div>
      <nav aria-label="Navegación principal">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => onTab("dashboard")}><span>▦</span> Inventario</button>
        <button className={tab === "movements" ? "active" : ""} onClick={() => onTab("movements")}><span>⇄</span> Movimientos</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => onTab("settings")}><span>⚙</span> Configuración</button>
      </nav>
      <div className="secure">
        <span>✓</span>
        <div><strong>Conexión protegida</strong><small>Datos cifrados en tránsito y reposo</small></div>
      </div>
      <div className="profile">
        <div className="avatar">{(email || "?").slice(0, 2).toUpperCase()}</div>
        <div><strong>{email}</strong><small>Sesión autorizada</small></div>
        <button className="logout" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">⎋</button>
      </div>
    </aside>
  );
}
