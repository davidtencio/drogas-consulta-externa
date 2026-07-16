"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { activeMedicines, isValidCount, type Medicine } from "../lib/inventory";
import * as dataApi from "../lib/db";
import { useInventoryData } from "../hooks/useInventoryData";
import { useOnline } from "../hooks/useOnline";
import { ConnectionBanner } from "./ConnectionBanner";

/**
 * Pantalla de arqueo: contar varios medicamentos en una sola sesión y
 * registrarlos como evidencia (conteos) de un solo envío. No ajusta el stock.
 */
export function ArqueoScreen({ email }: { email: string }) {
  const { medicines, pharmacists, pendingWrites } = useInventoryData(true);
  const online = useOnline();

  const [counts, setCounts] = useState<Record<string, string>>({});
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

  // Entradas con un físico válido (entero ≥ 0).
  const entries = useMemo(() => {
    const list: { medicine: Medicine; countedQuantity: number }[] = [];
    for (const m of activeMeds) {
      const raw = counts[m.id];
      if (raw == null || raw.trim() === "") continue;
      const n = Number(raw);
      if (isValidCount(n)) list.push({ medicine: m, countedQuantity: n });
    }
    return list;
  }, [activeMeds, counts]);

  const flash = useCallback((msg: string) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); }, []);
  const setCount = useCallback((id: string, value: string) => setCounts((c) => ({ ...c, [id]: value })), []);

  const submit = useCallback(async () => {
    if (!pharmacistEmail) { flash("Seleccione el farmacéutico responsable."); return; }
    if (!entries.length) { flash("Ingrese al menos un conteo."); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await dataApi.registerCounts(
        entries.map((e) => ({ medicine: { id: e.medicine.id, name: e.medicine.name, stock: e.medicine.stock }, countedQuantity: e.countedQuantity })),
        note.trim(),
        pharmacistEmail,
        now
      );
      flash(`Arqueo registrado: ${entries.length} conteo${entries.length > 1 ? "s" : ""}${online ? "" : " (se sincronizará al reconectar)"}`);
      setCounts({});
      setNote("");
    } catch {
      flash("No se pudo registrar el arqueo");
    } finally { setBusy(false); }
  }, [entries, pharmacistEmail, note, online, flash]);

  return (
    <main className="arqueo">
      <header className="arqueo-head">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Arqueo de inventario</h1>
          <p>Cuente el físico de cada medicamento. Se registra como evidencia; no modifica existencias.</p>
        </div>
        <Link className="secondary" href="/">← Volver a la app</Link>
      </header>

      <ConnectionBanner online={online} pendingWrites={pendingWrites} />

      <div className="arqueo-controls">
        <label className="search"><span>⌕</span><input aria-label="Buscar medicamento" placeholder="Buscar medicamento…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label>Farmacéutico responsable<select aria-label="Farmacéutico responsable" value={pharmacistEmail} onChange={(e) => setPharmacistEmail(e.target.value)}><option value="" disabled>Seleccione…</option>{activePharmacists.map((p) => <option key={p.id} value={p.email}>{p.name} — {p.license}</option>)}</select></label>
        <label>Nota del arqueo<input aria-label="Nota del arqueo" placeholder="Opcional" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>

      {!activeMeds.length ? <div className="panel"><div className="empty-block">No hay medicamentos activos para contar.</div></div>
        : <div className="arqueo-list">
            {shown.map((m) => {
              const raw = counts[m.id] ?? "";
              const n = Number(raw);
              const has = raw.trim() !== "" && isValidCount(n);
              const diff = has ? n - m.stock : null;
              const diffClass = diff === null || diff === 0 ? "" : diff > 0 ? "pos" : "neg";
              const diffLabel = diff === null ? "" : diff === 0 ? "Sin diferencia" : diff > 0 ? `Sobrante +${diff}` : `Faltante ${diff}`;
              return (
                <div className={`arqueo-row${has ? " counted" : ""}`} key={m.id}>
                  <div className="arqueo-med"><strong>{m.name}</strong><small>{m.strength} · {m.form}</small></div>
                  <div className="arqueo-sys"><small>Sistema</small><span>{m.stock.toLocaleString("es-CR")}</span></div>
                  <label className="arqueo-input">Físico<input inputMode="numeric" type="number" min="0" step="1" value={raw} onChange={(e) => setCount(m.id, e.target.value)} /></label>
                  {diff !== null && <span className={`count-diff ${diffClass}`}>{diffLabel}</span>}
                </div>
              );
            })}
            {!shown.length && <div className="empty-block">Ningún medicamento coincide con la búsqueda.</div>}
          </div>}

      <div className="arqueo-footer">
        <span className="arqueo-progress">{entries.length} contado{entries.length === 1 ? "" : "s"} de {activeMeds.length}</span>
        {!activePharmacists.length && <small className="form-hint">Registre un farmacéutico autorizado en la app para poder continuar.</small>}
        <button className="primary" onClick={submit} disabled={busy || !entries.length || !pharmacistEmail}>{busy ? "Registrando…" : `Registrar arqueo (${entries.length})`}</button>
      </div>

      <p className="arqueo-user">Sesión: {email}</p>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
