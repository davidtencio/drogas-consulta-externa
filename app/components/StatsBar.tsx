import type { InventoryFilter, InventorySummary } from "../lib/inventoryView";

/** Métrica sobre la que se puede filtrar el inventario o navegar. */
export type StatKey = "all" | "low" | "expired" | "soon";

type Props = {
  summary: InventorySummary;
  onSelect: (key: StatKey) => void;
  active: InventoryFilter;
  disabled?: boolean;
};

type Item = { key: StatKey; label: string; value: number; sub: string };

/** Conteos por medicamento, sin sumar unidades distintas. Las categorías pueden solaparse. */
export function StatsBar({ summary, onSelect, active, disabled = false }: Props) {
  const items: Item[] = [
    { key: "all", label: "Medicamentos en catálogo", value: summary.total, sub: "Presentaciones activas" },
    { key: "low", label: "Con stock bajo", value: summary.low, sub: "Al mínimo o por debajo" },
    { key: "expired", label: "Con lotes vencidos", value: summary.expired, sub: "Lotes con saldo" },
    { key: "soon", label: "Con lotes por vencer", value: summary.soon, sub: "Desde hoy hasta 30 días" },
  ];

  return (
    <div className="inventory-summary" aria-label="Resumen del inventario">
      {items.map(({ key, label, value, sub }) => {
        const inner = <>
          <span>{label}</span><strong>{disabled ? "—" : value.toLocaleString("es-CR")}</strong><small>{sub}</small>
        </>;
        return (
          <button
            key={key}
            type="button"
            className={`inventory-metric${active === key ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => onSelect(key)}
            aria-pressed={active === key}
            aria-label={`Filtrar: ${label}`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
