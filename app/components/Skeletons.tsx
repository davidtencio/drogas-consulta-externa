/**
 * Placeholders de carga. Reservan el mismo espacio que el contenido real para
 * evitar saltos de layout y comunicar que los datos están en camino. Son
 * puramente decorativos: `aria-hidden` los oculta a lectores de pantalla, que
 * reciben el estado mediante el `role="status"` del contenedor.
 */

/** Fila de tarjetas de estadística en carga. */
export function StatsSkeleton() {
  return (
    <div className="stats" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <article key={i} className="skeleton-stat">
          <span className="sk sk-icon" />
          <div>
            <span className="sk sk-line sk-sm" />
            <span className="sk sk-line sk-lg" />
            <span className="sk sk-line sk-xs" />
          </div>
        </article>
      ))}
    </div>
  );
}

/** Grilla de tarjetas de medicamento en carga. */
export function MedicineGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="medicine-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <article key={i} className="medicine-card skeleton-card">
          <div className="card-head"><span className="sk sk-pill" /><span className="sk sk-badge" /></div>
          <span className="sk sk-line sk-title" />
          <span className="sk sk-line sk-sm" />
          <span className="sk sk-line sk-num" />
          <span className="sk sk-bar" />
          <div className="meta"><span className="sk sk-line" /><span className="sk sk-line" /><span className="sk sk-line" /></div>
          <div className="skeleton-actions"><span className="sk" /><span className="sk" /><span className="sk" /></div>
        </article>
      ))}
    </div>
  );
}

/** Filas de la tabla de movimientos en carga. */
export function MovementRowsSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}><span className="sk sk-line" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
