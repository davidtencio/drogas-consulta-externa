import { Icon, type IconName } from "./Icon";

/** Métrica sobre la que se puede filtrar el inventario o navegar. */
export type StatKey = "all" | "low" | "expiring" | "recent";

type Props = {
  total: number;
  low: number;
  expiring: number;
  recent: number;
  onSelect?: (key: StatKey) => void;
  active?: StatKey;
};

type Item = { key: StatKey; icon: IconName; tone: string; label: string; value: number; sub: string };

/** Franja de estadísticas del dashboard. Cuando recibe `onSelect`, cada tarjeta
 * es un botón que filtra el inventario (o navega, en el caso de movimientos). */
export function StatsBar({ total, low, expiring, recent, onSelect, active }: Props) {
  const items: Item[] = [
    { key: "all", icon: "box", tone: "blue", label: "Existencias totales", value: total, sub: "unidades disponibles" },
    { key: "low", icon: "alert", tone: "amber", label: "Stock bajo", value: low, sub: "requieren atención" },
    { key: "expiring", icon: "clock", tone: "red", label: "Próximos a vencer", value: expiring, sub: "vencidos o ≤30 días" },
    { key: "recent", icon: "movements", tone: "green", label: "Movimientos recientes", value: recent, sub: "últimos registros" },
  ];

  return (
    <div className="stats">
      {items.map(({ key, icon, tone, label, value, sub }) => {
        const inner = <>
          <span className={`stat-icon ${tone}`}><Icon name={icon} /></span>
          <div><small>{label}</small><strong>{value.toLocaleString("es-CR")}</strong><em>{sub}</em></div>
        </>;
        if (!onSelect) return <article key={key}>{inner}</article>;
        const isFilter = key === "low" || key === "expiring";
        return (
          <button
            key={key}
            type="button"
            className={`stat-btn${active === key ? " stat-active" : ""}`}
            onClick={() => onSelect(key)}
            aria-pressed={isFilter ? active === key : undefined}
            aria-label={key === "recent" ? "Ver historial de movimientos" : `Filtrar: ${label}`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
