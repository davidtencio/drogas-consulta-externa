type Props = {
  total: number;
  low: number;
  expiring: number;
  recent: number;
};

/** Franja de estadísticas del dashboard. */
export function StatsBar({ total, low, expiring, recent }: Props) {
  return (
    <div className="stats">
      <article>
        <span className="stat-icon blue">▤</span>
        <div><small>Existencias totales</small><strong>{total.toLocaleString("es-CR")}</strong><em>unidades disponibles</em></div>
      </article>
      <article>
        <span className="stat-icon amber">!</span>
        <div><small>Stock bajo</small><strong>{low}</strong><em>requieren atención</em></div>
      </article>
      <article>
        <span className="stat-icon red">⏱</span>
        <div><small>Próximos a vencer</small><strong>{expiring}</strong><em>vencidos o &le;30 días</em></div>
      </article>
      <article>
        <span className="stat-icon green">⇄</span>
        <div><small>Movimientos recientes</small><strong>{recent}</strong><em>últimos registros</em></div>
      </article>
    </div>
  );
}
