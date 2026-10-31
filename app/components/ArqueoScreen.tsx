"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { activeMedicines } from "../lib/inventory";
import { lastCountByMedicine } from "../lib/movements";
import * as dataApi from "../lib/db";
import { useInventoryData } from "../hooks/useInventoryData";
import { useOnline } from "../hooks/useOnline";
import { ConnectionBanner } from "./ConnectionBanner";
import { Icon } from "./Icon";
import { ObservationField } from "./ObservationField";
import { PageHeader } from "./PageHeader";
import { DEMO_MODE } from "../lib/demo";

/**
 * Pantalla de arqueo: confirmar el saldo de cada medicamento con una casilla
 * (el físico coincide con el sistema) o registrar la cantidad física contada.
 * Registra los conteos como evidencia de un solo envío. No ajusta el stock.
 */
export function ArqueoScreen({ email }: { email: string }) {
  const { medicines, pharmacists, movements, countMovements, pendingWrites, settingsLoading: loading, settingsError: error, movementsLoading, movementsError, retryInventory } = useInventoryData(true);
  const online = useOnline();
  const lastCounts = useMemo(() => lastCountByMedicine(countMovements ?? movements), [countMovements, movements]);

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [countedQuantities, setCountedQuantities] = useState<Record<string, string>>({});
  const [countFilter, setCountFilter] = useState<"all" | "pending-30d" | "unconfirmed" | "with-diff">("all");
  const [pharmacistEmail, setPharmacistEmail] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [observationKey, setObservationKey] = useState(0);

  const today = useMemo(() => new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), []);
  const activeMeds = useMemo(() => activeMedicines(medicines), [medicines]);
  const activePharmacists = useMemo(() => pharmacists.filter((p) => p.active !== false), [pharmacists]);
  const q = search.trim().toLowerCase();
  const resolveCountedQty = useCallback((id: string, stock: number): number => {
    const raw = countedQuantities[id]?.trim();
    if (raw === undefined || raw === "") return stock;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : stock;
  }, [countedQuantities]);

  const shown = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const thirtyDaysAgoIso = cutoff.toISOString();
    return activeMeds.filter((m) => {
      if (q && !`${m.name} ${m.strength}`.toLowerCase().includes(q)) return false;
      if (countFilter === "pending-30d") {
        const last = lastCounts.get(m.id);
        return !last || last < thirtyDaysAgoIso;
      }
      if (countFilter === "unconfirmed") return !confirmed[m.id];
      if (countFilter === "with-diff") return resolveCountedQty(m.id, m.stock) !== m.stock;
      return true;
    });
  }, [activeMeds, q, countFilter, lastCounts, confirmed, resolveCountedQty]);

  const confirmedCount = useMemo(() => activeMeds.filter((m) => confirmed[m.id]).length, [activeMeds, confirmed]);
  const allOn = activeMeds.length > 0 && confirmedCount === activeMeds.length;

  const flash = useCallback((msg: string) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); }, []);
  const toggle = useCallback((id: string) => setConfirmed((c) => ({ ...c, [id]: !c[id] })), []);
  const updateCountedQuantity = useCallback((id: string, value: string) => {
    setCountedQuantities((prev) => ({ ...prev, [id]: value }));
    if (value.trim() !== "") {
      setConfirmed((c) => ({ ...c, [id]: true }));
    }
  }, []);
  const toggleAll = useCallback(() => {
    setConfirmed(allOn ? {} : Object.fromEntries(activeMeds.map((m) => [m.id, true])));
  }, [allOn, activeMeds]);

  const submit = useCallback(async () => {
    if (!pharmacistEmail) { flash("Seleccione el farmacéutico responsable."); return; }
    const entries = activeMeds
      .filter((m) => confirmed[m.id])
      .map((m) => ({
        medicine: { id: m.id, name: m.name, stock: m.stock },
        countedQuantity: resolveCountedQty(m.id, m.stock),
      }));
    if (!entries.length) { flash("Confirme al menos un saldo."); return; }
    setBusy(true);
    try {
      await dataApi.registerCounts(entries, note.trim(), pharmacistEmail, new Date().toISOString());
      flash(`Toma de inventario registrada: ${entries.length} saldo${entries.length > 1 ? "s" : ""} confirmado${entries.length > 1 ? "s" : ""}${online ? "" : " (se sincronizará al reconectar)"}`);
      setConfirmed({});
      setCountedQuantities({});
      setNote("");
      setObservationKey((key) => key + 1);
    } catch {
      flash("No se pudo registrar la toma de inventario");
    } finally { setBusy(false); }
  }, [activeMeds, confirmed, resolveCountedQty, pharmacistEmail, note, online, flash]);

  return (
    <main className="arqueo">
      {DEMO_MODE && <div className="demo-banner" role="status"><strong>Modo demostración</strong><span>Datos ficticios · los cambios solo permanecen durante esta sesión</span></div>}
      <PageHeader eyebrow={today} title="Toma de inventario" description="Compare el saldo físico con el sistema y confirme las coincidencias. El registro no ajusta existencias." action={<Link className="secondary" href="/"><Icon name="arrow-left" size={16} /> Volver a la app</Link>}/>

      <ConnectionBanner online={online} pendingWrites={pendingWrites} />

      <section className="panel count-session" aria-label="Preparar toma de inventario">
      <div className="panel-title"><div><h2>Preparar la revisión</h2><p>Seleccione a la persona responsable y marque únicamente los saldos que haya verificado.</p></div></div>
      <div className="arqueo-controls">
        <label className="search"><span><Icon name="search" size={16} /></span><input aria-label="Buscar medicamento" placeholder="Buscar medicamento…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label>Estado de revisión<select aria-label="Estado de revisión" value={countFilter} onChange={(e) => setCountFilter(e.target.value as typeof countFilter)}><option value="all">Todos los medicamentos</option><option value="pending-30d">Sin toma reciente (30 días)</option><option value="unconfirmed">Pendientes en esta sesión</option><option value="with-diff">Con diferencia física</option></select></label>
        <label>Farmacéutico responsable<select aria-label="Farmacéutico responsable" value={pharmacistEmail} onChange={(e) => setPharmacistEmail(e.target.value)}><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
      </div>
      <div className="arqueo-observation"><ObservationField key={observationKey} label="Observación de la toma de inventario" onValueChange={setNote} /></div>
      </section>

      {error ? <div className="panel empty-block" role="alert"><p>{error}</p><button className="secondary" onClick={retryInventory}>Reintentar</button></div> : loading ? <div className="panel empty-block" role="status">Cargando medicamentos y responsables…</div> : !activeMeds.length ? <div className="panel"><div className="empty-block">No hay medicamentos activos para arquear.</div></div>
        : <>
            <label className="arqueo-all"><input type="checkbox" checked={allOn} onChange={toggleAll} /> Confirmar todos</label>
            <p className="count-scope">La selección general incluye los {activeMeds.length} medicamentos activos, incluso los ocultos por la búsqueda. Puede indicar una cantidad física distinta para dejar constancia de diferencias.</p>
            <div className="arqueo-list">
              {shown.map((m) => {
                const on = !!confirmed[m.id];
                const countedQty = resolveCountedQty(m.id, m.stock);
                const diff = countedQty - m.stock;
                return (
                  <div className={`arqueo-row${on ? " counted" : ""}`} key={m.id}>
                    <input type="checkbox" className="arqueo-check" checked={on} onChange={() => toggle(m.id)} aria-label={`Confirmar saldo de ${m.name}`} />
                    <div className="arqueo-med">
                      <strong>{m.name}</strong>
                      <small>{m.strength} · {m.form}</small>
                      <small className="arqueo-last">Últ. toma: {movementsLoading ? "consultando…" : movementsError ? "historial no disponible" : lastCounts.has(m.id) ? new Date(lastCounts.get(m.id)!).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" }) : "sin tomas en los registros consultados"}</small>
                    </div>
                    <div className="arqueo-sys"><small>En sistema</small><span>{m.stock.toLocaleString("es-CR")}</span><small>{m.unit}</small></div>
                    <label className="arqueo-counted">
                      <small>Físico contado</small>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`Cantidad física de ${m.name}`}
                        value={countedQuantities[m.id] ?? String(m.stock)}
                        onChange={(e) => updateCountedQuantity(m.id, e.target.value)}
                      />
                      {diff !== 0 && <small className="arqueo-diff">Dif: {diff > 0 ? `+${diff}` : diff}</small>}
                    </label>
                  </div>
                );
              })}
              {!shown.length && <div className="empty-block">Ningún medicamento coincide con la búsqueda.</div>}
            </div>
          </>}

      <div className="arqueo-footer">
        <div className="arqueo-progress" role="status"><strong>{confirmedCount} confirmado{confirmedCount === 1 ? "" : "s"} de {activeMeds.length}</strong><small>Se registran solo los medicamentos seleccionados.</small></div>
        {!loading && !error && !activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en la app para poder continuar.</small>}
        <button className="primary" onClick={submit} disabled={busy || loading || !!error || !confirmedCount || !pharmacistEmail}>{busy ? "Registrando…" : `Registrar toma (${confirmedCount})`}</button>
      </div>

      <p className="arqueo-user">Sesión: {email}</p>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
