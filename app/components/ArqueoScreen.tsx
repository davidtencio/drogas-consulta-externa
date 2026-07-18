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

/**
 * Pantalla de arqueo: confirmar el saldo de cada medicamento con una casilla
 * (el físico coincide con el sistema). Registra los conteos como evidencia de
 * un solo envío. No ajusta el stock.
 */
export function ArqueoScreen({ email }: { email: string }) {
  const { medicines, pharmacists, movements, pendingWrites } = useInventoryData(true);
  const online = useOnline();
  const lastCounts = useMemo(() => lastCountByMedicine(movements), [movements]);

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [pharmacistEmail, setPharmacistEmail] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const today = useMemo(() => new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), []);
  const activeMeds = useMemo(() => activeMedicines(medicines), [medicines]);
  const activePharmacists = useMemo(() => pharmacists.filter((p) => p.active !== false), [pharmacists]);
  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? activeMeds.filter((m) => `${m.name} ${m.strength}`.toLowerCase().includes(q)) : activeMeds),
    [activeMeds, q]
  );

  const confirmedCount = useMemo(() => activeMeds.filter((m) => confirmed[m.id]).length, [activeMeds, confirmed]);
  const allOn = activeMeds.length > 0 && confirmedCount === activeMeds.length;

  const flash = useCallback((msg: string) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); }, []);
  const toggle = useCallback((id: string) => setConfirmed((c) => ({ ...c, [id]: !c[id] })), []);
  const toggleAll = useCallback(() => {
    setConfirmed(allOn ? {} : Object.fromEntries(activeMeds.map((m) => [m.id, true])));
  }, [allOn, activeMeds]);

  const submit = useCallback(async () => {
    if (!pharmacistEmail) { flash("Seleccione el farmacéutico responsable."); return; }
    const entries = activeMeds.filter((m) => confirmed[m.id]).map((m) => ({ medicine: { id: m.id, name: m.name, stock: m.stock }, countedQuantity: m.stock }));
    if (!entries.length) { flash("Confirme al menos un saldo."); return; }
    setBusy(true);
    try {
      await dataApi.registerCounts(entries, note.trim(), pharmacistEmail, new Date().toISOString());
      flash(`Toma de inventario registrada: ${entries.length} saldo${entries.length > 1 ? "s" : ""} confirmado${entries.length > 1 ? "s" : ""}${online ? "" : " (se sincronizará al reconectar)"}`);
      setConfirmed({});
      setNote("");
    } catch {
      flash("No se pudo registrar la toma de inventario");
    } finally { setBusy(false); }
  }, [activeMeds, confirmed, pharmacistEmail, note, online, flash]);

  return (
    <main className="arqueo">
      <header className="arqueo-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Toma Inventario</h1>
          <p>Confirme el saldo de cada medicamento. Se registra como evidencia; no modifica existencias.</p>
        </div>
        <Link className="secondary" href="/"><Icon name="arrow-left" size={16} /> Volver a la app</Link>
      </header>

      <ConnectionBanner online={online} pendingWrites={pendingWrites} />

      <div className="arqueo-controls">
        <label className="search"><span><Icon name="search" size={16} /></span><input aria-label="Buscar medicamento" placeholder="Buscar medicamento…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label>Farmacéutico responsable<select aria-label="Farmacéutico responsable" value={pharmacistEmail} onChange={(e) => setPharmacistEmail(e.target.value)}><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
      </div>
      <div className="arqueo-observation"><ObservationField label="Observación de la toma de inventario" onValueChange={setNote} /></div>

      {!activeMeds.length ? <div className="panel"><div className="empty-block">No hay medicamentos activos para arquear.</div></div>
        : <>
            <label className="arqueo-all"><input type="checkbox" checked={allOn} onChange={toggleAll} /> Confirmar todos</label>
            <div className="arqueo-list">
              {shown.map((m) => {
                const on = !!confirmed[m.id];
                return (
                  <label className={`arqueo-row${on ? " counted" : ""}`} key={m.id}>
                    <input type="checkbox" className="arqueo-check" checked={on} onChange={() => toggle(m.id)} aria-label={`Confirmar saldo de ${m.name}`} />
                    <div className="arqueo-med">
                      <strong>{m.name}</strong>
                      <small>{m.strength} · {m.form}</small>
                      <small className="arqueo-last">Últ. toma: {lastCounts.has(m.id) ? new Date(lastCounts.get(m.id)!).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" }) : "sin tomas"}</small>
                    </div>
                    <div className="arqueo-sys"><small>Sistema</small><span>{m.stock.toLocaleString("es-CR")}</span></div>
                  </label>
                );
              })}
              {!shown.length && <div className="empty-block">Ningún medicamento coincide con la búsqueda.</div>}
            </div>
          </>}

      <div className="arqueo-footer">
        <span className="arqueo-progress">{confirmedCount} confirmado{confirmedCount === 1 ? "" : "s"} de {activeMeds.length}</span>
        {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en la app para poder continuar.</small>}
        <button className="primary" onClick={submit} disabled={busy || !confirmedCount || !pharmacistEmail}>{busy ? "Registrando…" : `Registrar toma (${confirmedCount})`}</button>
      </div>

      <p className="arqueo-user">Sesión: {email}</p>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
