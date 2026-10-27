import { useCallback, useMemo, useState, type RefObject } from "react";
import type { Medicine, MovementType } from "../lib/inventory";
import { selectInventory, summarizeInventory, type InventoryFilter, type InventorySort } from "../lib/inventoryView";
import type { InventoryCertification } from "./MedicineCard";
import { Icon } from "./Icon";
import { StatsBar } from "./StatsBar";
import { StockLabel, MedicineExpiryLabel } from "./InventoryLabels";
import { InventoryDetail } from "./InventoryDetail";

type Props = {
  medicines: Medicine[];
  certifications: ReadonlyMap<string, InventoryCertification>;
  searchRef: RefObject<HTMLInputElement | null>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMovement: (id: string, type: MovementType) => void;
  onCount: (id: string) => void;
  onViewMovements: (id: string) => void;
  onExport: (medicines: Medicine[]) => void;
};

function MedicineIdentity({ medicine }: { medicine: Medicine }) {
  return <><strong className="inventory-name">{medicine.name}</strong><span className="inventory-presentation">{medicine.strength} · {medicine.form}</span><span className="inventory-code">{medicine.code || "Código no registrado"}</span></>;
}

function MedicineQuantity({ medicine }: { medicine: Medicine }) {
  return <><strong className="inventory-quantity">{medicine.stock.toLocaleString("es-CR")}</strong><span className="inventory-unit">{medicine.unit}</span></>;
}

function DetailButton({ medicine, onOpen }: { medicine: Medicine; onOpen: (id: string) => void }) {
  return <button type="button" className="inventory-text-button" aria-label={`Ver detalle de ${medicine.name} ${medicine.strength}`} onClick={() => onOpen(medicine.id)}>Ver detalle<Icon name="chevron-right" size={14}/></button>;
}

export function InventoryPanel({ medicines, certifications, searchRef, loading, error, onRetry, onMovement, onCount, onViewMovements, onExport }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [sort, setSort] = useState<InventorySort>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeDetail = useCallback(() => setSelectedId(null), []);
  const summary = useMemo(() => summarizeInventory(medicines), [medicines]);
  const shown = useMemo(() => selectInventory(medicines, query, filter, sort), [medicines, query, filter, sort]);
  const selected = medicines.find((medicine) => medicine.id === selectedId);
  const unavailable = loading || !!error;
  const disabled = unavailable || medicines.length === 0;
  const resetFilters = () => { setQuery(""); setFilter("all"); setSort("name"); searchRef.current?.focus(); };

  return <>
    <StatsBar summary={summary} active={filter} onSelect={setFilter} disabled={unavailable}/>
    {!unavailable && summary.unknown > 0 && <div className="inventory-data-warning"><Icon name="alert" size={18}/><p>{summary.unknown} medicamento{summary.unknown === 1 ? " requiere" : "s requieren"} revisar fechas o desglose de lotes.</p><button type="button" className="inventory-text-button" onClick={() => setFilter("unknown")}>Revisar información</button></div>}
    <section className="inventory-panel" aria-labelledby="inventory-list-title">
      <div className="inventory-panel-heading"><div><h2 id="inventory-list-title">Medicamentos</h2><p>Existencias registradas, vencimientos y trazabilidad por lote.</p></div><button type="button" className="secondary" disabled={unavailable || !shown.length} onClick={() => onExport(shown)}><Icon name="download" size={16}/>Exportar vista CSV</button></div>
      <div className="inventory-toolbar">
        <label className="inventory-search"><Icon name="search" size={18}/><input ref={searchRef} type="search" aria-label="Buscar medicamentos" placeholder="Buscar medicamento, código o lote…" value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled}/><kbd aria-hidden="true">/</kbd></label>
        <label><span className="sr-only">Filtrar inventario</span><select aria-label="Filtrar inventario" value={filter} onChange={(event) => setFilter(event.target.value as InventoryFilter)} disabled={disabled}><option value="all">Todos los estados</option><option value="low">Stock bajo</option><option value="expired">Con lotes vencidos</option><option value="soon">Con lotes por vencer</option><option value="unknown">Información por revisar</option><option value="no-stock">Sin existencias</option><option value="normal">Sin alertas</option></select></label>
        <label><span className="sr-only">Ordenar medicamentos</span><select aria-label="Ordenar medicamentos" value={sort} onChange={(event) => setSort(event.target.value as InventorySort)} disabled={disabled}><option value="name">Nombre A–Z</option><option value="stock">Menor existencia</option><option value="expiry">Vencimiento cercano</option></select></label>
      </div>
      {loading ? <div className="inventory-loading" role="status"><p>Cargando inventario…</p><div aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="sk inventory-skeleton-row" key={index}/>)}</div></div>
        : error ? <div className="inventory-empty"><h3>No se pudo consultar el inventario</h3><p role="alert">{error}</p><button type="button" className="secondary" onClick={onRetry}>Reintentar consulta</button></div>
        : !medicines.length ? <div className="inventory-empty"><h3>Sin medicamentos activos</h3><p>Consulte el catálogo y sus estados en Configuración.</p></div>
        : !shown.length ? <div className="inventory-empty"><Icon name="search" size={30}/><h3>No encontramos medicamentos</h3><p>Pruebe con otro nombre o quite los filtros.</p><button type="button" className="secondary" onClick={resetFilters}>Limpiar búsqueda y filtros</button></div>
        : <>
          <div className="inventory-table-container">
            <table className="inventory-table"><caption className="sr-only">Inventario de medicamentos. Cada cantidad conserva su unidad. Consulte el detalle para ver los lotes.</caption>
              <thead><tr><th scope="col">Medicamento</th><th scope="col" className="inventory-numeric">Existencia registrada</th><th scope="col">Nivel de stock</th><th scope="col">Vencimiento más cercano</th><th scope="col"><span className="sr-only">Detalle</span></th></tr></thead>
              <tbody>{shown.map((medicine) => <tr key={medicine.id}><td><MedicineIdentity medicine={medicine}/></td><td className="inventory-numeric"><MedicineQuantity medicine={medicine}/></td><td><StockLabel medicine={medicine}/></td><td><MedicineExpiryLabel medicine={medicine}/></td><td><DetailButton medicine={medicine} onOpen={setSelectedId}/></td></tr>)}</tbody>
            </table>
          </div>
          <div className="inventory-cards">{shown.map((medicine) => <article className="inventory-item" key={medicine.id} aria-label={`${medicine.name} ${medicine.strength}`}><div className="inventory-item-header"><div><MedicineIdentity medicine={medicine}/></div><div className="inventory-numeric"><span className="sr-only">Existencia registrada: </span><MedicineQuantity medicine={medicine}/></div></div><div className="inventory-item-meta"><StockLabel medicine={medicine}/><div><span className="sr-only">Vencimiento más cercano: </span><MedicineExpiryLabel medicine={medicine}/></div></div><div className="inventory-item-actions"><DetailButton medicine={medicine} onOpen={setSelectedId}/></div></article>)}</div>
        </>}
      <footer className="inventory-footer"><span role="status" aria-live="polite" aria-atomic="true">{unavailable ? "Sin datos confirmados para esta consulta" : `${shown.length} de ${medicines.length} medicamentos${query || filter !== "all" ? " · Vista filtrada" : ""}`}</span><span className="inventory-footer-hint">Las categorías de vencimiento pueden compartir medicamentos.</span></footer>
    </section>
    {selected && <InventoryDetail medicine={selected} certification={certifications.get(selected.id)} onClose={closeDetail} onMovement={(type) => { closeDetail(); onMovement(selected.id, type); }} onCount={() => { closeDetail(); onCount(selected.id); }} onViewMovements={() => { closeDetail(); onViewMovements(selected.id); }}/>}
  </>;
}
