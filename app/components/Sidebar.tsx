import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icon";
import type { AppRole } from "../lib/authz";

export type Tab = "dashboard" | "movements" | "settings";

type Props = {
  email: string;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onSignOut: () => void;
  demo?: boolean;
  role: AppRole;
};

/** Barra lateral: navegación entre pestañas y perfil de la sesión. */
export function Sidebar({ email, tab, onTab, onSignOut, demo = false, role }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">Rx</span>
        <div><strong>Control de Drogas</strong><small>Consulta externa</small></div>
      </div>
      <nav aria-label="Navegación principal">
        <button className={tab === "dashboard" ? "active" : ""} aria-current={tab === "dashboard" ? "page" : undefined} onClick={() => onTab("dashboard")}><span aria-hidden="true"><Icon name="grid" /></span> Inventario</button>
        <button className={tab === "movements" ? "active" : ""} aria-current={tab === "movements" ? "page" : undefined} onClick={() => onTab("movements")}><span aria-hidden="true"><Icon name="movements" /></span> Movimientos</button>
        {role === "admin" && <button className={tab === "settings" ? "active" : ""} aria-current={tab === "settings" ? "page" : undefined} onClick={() => onTab("settings")}><span aria-hidden="true"><Icon name="settings" /></span> Configuración</button>}
        <Link href="/arqueo"><span aria-hidden="true"><Icon name="arqueo" /></span> Arqueo</Link>
      </nav>
      <div className="secure">
        <span><Icon name="shield" size={18} /></span>
        <div><strong>Conexión protegida</strong><small>Datos cifrados en tránsito y reposo</small></div>
      </div>
      <ThemeToggle />
      <div className="profile">
        <div className="avatar">{(email || "?").slice(0, 2).toUpperCase()}</div>
        <div><strong>{email}</strong><small>{demo ? "Administrador demo" : role === "admin" ? "Administrador" : "Operador"}</small></div>
        {!demo&&<button className="logout" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="logout" size={18} /></button>}
      </div>
    </aside>
  );
}
