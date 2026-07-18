import { useCallback, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query as fbQuery } from "firebase/firestore";
import { db } from "../firebase";
import { displayPharmacist, sortByName, type Medicine, type Movement } from "../lib/inventory";
import { movementsToCsv } from "../lib/csv";
import { filterAndSortMovements, summarizeMovements, type MovementSort, type MovementTypeFilter } from "../lib/movements";
import { clampPage, pageCount, pageRange, paginate } from "../lib/pagination";
import { dateStamp, downloadTextFile } from "../lib/download";
import { MovementRowsSkeleton } from "./Skeletons";
import { Icon } from "./Icon";
import { AccessibleDialog } from "./AccessibleDialog";

type Props = {
  movements: Movement[];
  medicines: Medicine[];
  pharmacistNames: ReadonlyMap<string, string>;
  onNotice: (msg: string) => void;
  loading?: boolean;
  initialMedicineId?: string;
  onMedicineFilterChange?: (medicineId: string) => void;
};

/** Pestaña de Movimientos: filtros, resumen del período, tabla y paginación. */
export function MovementsTab({ movements, medicines, pharmacistNames, onNotice, loading = false, initialMedicineId = "", onMedicineFilterChange }: Props) {
  const [type, setType] = useState<MovementTypeFilter>("ALL");
  const [text, setText] = useState("");
  const [medicineId, setMedicineId] = useState(initialMedicineId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<MovementSort>("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [observed, setObserved] = useState<Movement | null>(null);

  const medicineOptions = useMemo(() => sortByName(medicines), [medicines]);
  const filter = useMemo(() => ({ type, text, medicineId, from, to }), [type, text, medicineId, from, to]);
  const visible = useMemo(() => filterAndSortMovements(movements, filter, sort), [movements, filter, sort]);
  const summary = useMemo(() => summarizeMovements(visible), [visible]);
  const filtered = type !== "ALL" || !!text || !!medicineId || !!from || !!to;
  const selectedMedicine = useMemo(() => medicines.find((m) => m.id === medicineId), [medicines, medicineId]);
  const changeMedicine = useCallback((id: string) => { setMedicineId(id); onMedicineFilterChange?.(id); }, [onMedicineFilterChange]);
  const clearFilters = useCallback(() => { setType("ALL"); setText(""); changeMedicine(""); setFrom(""); setTo(""); }, [changeMedicine]);

  // Al cambiar filtros, orden o tamaño de página, vuelve a la primera página.
  const sig = `${type}|${text}|${medicineId}|${from}|${to}|${sort}|${pageSize}`;
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) { setPrevSig(sig); setPage(1); }

  const pageNum = clampPage(page, visible.length, pageSize);
  const totalPages = pageCount(visible.length, pageSize);
  const pageItems = useMemo(() => paginate(visible, pageNum, pageSize), [visible, pageNum, pageSize]);
  const shown = pageRange(visible.length, pageNum, pageSize);
  const resolveName = useCallback((email: string) => displayPharmacist(email, pharmacistNames), [pharmacistNames]);

  const onExport = useCallback(async () => {
    try {
      // La vista carga solo los más recientes; para exportar traemos el historial
      // completo y aplicamos los mismos filtros y orden que ve el usuario.
      const snap = await getDocs(fbQuery(collection(db, "movements"), orderBy("createdAt", "desc")));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movement));
      const rows = filterAndSortMovements(all, filter, sort);
      if (!rows.length) { onNotice("No hay movimientos que coincidan para exportar"); return; }
      const range = [from, to].filter(Boolean).join("_");
      downloadTextFile(`movimientos_${range || dateStamp()}.csv`, movementsToCsv(rows, resolveName));
      onNotice(`Movimientos exportados (${rows.length})`);
    } catch { onNotice("No se pudo exportar los movimientos"); }
  }, [filter, sort, from, to, resolveName, onNotice]);

  return <>
    <div className="panel">
      <div className="panel-title">
        <div><h2>{selectedMedicine ? `Movimientos de ${selectedMedicine.name} ${selectedMedicine.strength}` : "Actividad reciente"}</h2><p>{selectedMedicine ? "Historial filtrado de ingresos, egresos y conteos de este medicamento." : "Cada operación conserva responsable, fecha y referencia."}</p></div>
        <button className="secondary" onClick={onExport}><Icon name="download" size={16} /> Exportar CSV</button>
      </div>
      <div className="mov-filters">
        <label className="search"><span><Icon name="search" size={16} /></span><input aria-label="Buscar movimientos" placeholder="Buscar por medicamento o prescripción..." value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label>Medicamento<select aria-label="Filtrar por medicamento" value={medicineId} onChange={(e) => changeMedicine(e.target.value)}><option value="">Todos</option>{medicineOptions.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}</select></label>
        <label>Tipo<select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value as MovementTypeFilter)}><option value="ALL">Todos</option><option value="IN">Ingresos</option><option value="OUT">Egresos</option><option value="COUNT">Conteos</option></select></label>
        <label>Desde<input type="date" lang="es-CR" aria-label="Desde" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" lang="es-CR" aria-label="Hasta" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <label>Orden<select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as MovementSort)}><option value="date-desc">Fecha (reciente)</option><option value="date-asc">Fecha (antiguo)</option><option value="qty-desc">Cantidad (mayor)</option><option value="qty-asc">Cantidad (menor)</option></select></label>
        {filtered && <button type="button" className="mov-clear" onClick={clearFilters}>Limpiar</button>}
        {selectedMedicine && <button type="button" className="mov-clear" onClick={() => changeMedicine("")}>Ver todos los movimientos</button>}
        <span className="mov-count">{visible.length} de {movements.length}</span>
      </div>
      <div className="mov-summary">
        <div><small>{from || to ? "Período" : "Movimientos"}</small><strong>{summary.count}</strong><em>{from || "inicio"} → {to || "hoy"}</em></div>
        <div className="in"><small>Ingresos</small><strong>+{summary.inQuantity.toLocaleString("es-CR")}</strong><em>{summary.inCount} registros</em></div>
        <div className="out"><small>Egresos</small><strong>−{summary.outQuantity.toLocaleString("es-CR")}</strong><em>{summary.outCount} registros</em></div>
        <div><small>Variación neta</small><strong className={summary.net < 0 ? "neg" : summary.net > 0 ? "pos" : ""}>{summary.net > 0 ? "+" : ""}{summary.net.toLocaleString("es-CR")}</strong><em>{summary.medicineCount} medicamentos</em></div>
        <div><small>Conteos</small><strong>{summary.countEvents}</strong><em>arqueos</em></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Prescripción</th><th>Responsable</th></tr></thead>
          <tbody>
            {loading ? <MovementRowsSkeleton />
              : !movements.length ? <tr><td colSpan={6} className="empty">Aún no hay movimientos registrados.</td></tr>
              : pageItems.length ? pageItems.map((m) => (
                <tr key={m.id}>
                  <td data-label="Fecha">{new Date(m.createdAt).toLocaleString("es-CR")}</td>
                  <td data-label="Medicamento"><strong>{m.medicineName}</strong></td>
                  <td data-label="Tipo"><span className={`type ${m.type}`}>{m.type === "IN" ? "Ingreso" : m.type === "OUT" ? "Egreso" : "Conteo"}</span></td>
                  <td data-label="Cantidad">{m.quantity}{m.type === "COUNT" && <small className="cell-sub">sist. {m.systemQuantity} · {m.difference === 0 ? "sin dif." : m.difference != null && m.difference > 0 ? `+${m.difference}` : m.difference}</small>}</td>
                  <td data-label="Prescripción">{m.prescriptionRef || "—"}{m.note && <button type="button" className="observation-icon" title={m.note} aria-label={`Ver observación de ${m.medicineName}`} onClick={() => setObserved(m)}><Icon name="note" size={15} /></button>}</td>
                  <td data-label="Responsable">{resolveName(m.pharmacistEmail)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="empty">Ningún movimiento coincide con los filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {visible.length > 0 && (
        <div className="pager">
          <span className="pager-info">{shown.start}–{shown.end} de {visible.length}</span>
          <label className="pager-size">Por página<select aria-label="Movimientos por página" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <div className="pager-nav">
            <button onClick={() => setPage(pageNum - 1)} disabled={pageNum <= 1} aria-label="Página anterior"><Icon name="chevron-left" size={18} /></button>
            <span>Página {pageNum} de {totalPages}</span>
            <button onClick={() => setPage(pageNum + 1)} disabled={pageNum >= totalPages} aria-label="Página siguiente"><Icon name="chevron-right" size={18} /></button>
          </div>
        </div>
      )}
    </div>
    {observed?.note && <AccessibleDialog title="Observación del movimiento" description="Detalle registrado como parte de la trazabilidad." onClose={() => setObserved(null)}>
      <div className="observation-context"><div><small>Medicamento</small><strong>{observed.medicineName}</strong></div><div><small>Operación</small><strong>{observed.type === "IN" ? "Ingreso" : observed.type === "OUT" ? "Egreso" : "Arqueo / saldo"}</strong></div><div><small>Fecha</small><strong>{new Date(observed.createdAt).toLocaleString("es-CR")}</strong></div><div><small>Responsable</small><strong>{resolveName(observed.pharmacistEmail)}</strong></div></div>
      <div className="observation-detail">{observed.note}</div>
    </AccessibleDialog>}
  </>;
}
