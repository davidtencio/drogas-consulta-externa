"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { activeMedicines, pharmacistNameByEmail, type Medicine, type Movement, type MovementType, type Pharmacist } from "./lib/inventory";
import { summarizeInventory } from "./lib/inventoryView";
import { inventoryViewToCsv } from "./lib/csv";
import { lastCountMovementByMedicine } from "./lib/movements";
import { dateStamp, downloadTextFile } from "./lib/download";
import { fieldForFormError, parseCountForm, parseMedicineForm, parseMovementForm, parsePharmacistForm } from "./lib/forms";
import * as dataApi from "./lib/db";
import { useInventoryData } from "./hooks/useInventoryData";
import { useOnline } from "./hooks/useOnline";
import { useAuthUser } from "./hooks/useAuthUser";
import { Login } from "./components/Login";
import { Sidebar } from "./components/Sidebar";
import { PageHeader } from "./components/PageHeader";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ExpiryAlert } from "./components/ExpiryAlert";
import { InventoryPanel } from "./components/InventoryPanel";
import { Icon } from "./components/Icon";
import { MovementsTab } from "./components/MovementsTab";
import { SettingsTab } from "./components/SettingsTab";
import { Modals, type ModalState } from "./components/Modals";
import { CountModal } from "./components/CountModal";
import { VoidMovementDialog } from "./components/VoidMovementDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DEMO_MODE } from "./lib/demo";
import { canManageCatalog, canOperateInventory, roleForEmail } from "./lib/authz";
import { PILOT_MODE } from "./lib/pilot";

/** Estado de modal de la app: los diálogos de Modals más el conteo físico. */
type AppModal = ModalState | { kind: "count"; medicineId: string };
type Deactivation = { col: "medicines" | "pharmacists"; id: string; label: string };
type FormIssue = { message: string; field?: string };

async function saveMedicine(form: FormData, editing: Medicine | null) {
  const parsed = parseMedicineForm(form, editing);
  if (parsed.kind === "update") await dataApi.updateMedicine(parsed.id, parsed.fields);
  else await dataApi.createMedicine(parsed.fields, parsed.initialStock, parsed.pharmacistEmail);
}

async function savePharmacist(form: FormData, editing: Pharmacist | null) {
  const fields = parsePharmacistForm(form);
  if (editing) await dataApi.updatePharmacist(editing.id, fields);
  else await dataApi.createPharmacist(fields);
}

async function saveMovement(form: FormData, now: string, editing: Movement | null = null) {
  const parsed = parseMovementForm(form);
  if (editing) await dataApi.updateMovement({ ...parsed, movementId: editing.id, now });
  else await dataApi.registerMovement({ ...parsed, now });
}

async function saveCount(form: FormData, now: string, medicine: Medicine | undefined) {
  const parsed = parseCountForm(form, medicine);
  await dataApi.registerCount({ ...parsed, now });
}

export default function Home() {
  const { user, authReady, dynamicOperator } = useAuthUser();
  const baseRole = DEMO_MODE ? "admin" as const : roleForEmail(user?.email, { dynamicOperator });
  const [tab, setTab] = useState<"dashboard" | "movements" | "settings">("dashboard");
  const searchRef = useRef<HTMLInputElement>(null);
  const [movementMedicineId, setMovementMedicineId] = useState("");
  const [modal, setModal] = useState<AppModal | null>(null);
  const [notice, setNotice] = useState<{ message: string; critical: boolean } | null>(null);
  const [modalError, setModalError] = useState<FormIssue | null>(null);
  const [deactivation, setDeactivation] = useState<Deactivation | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const { medicines, pharmacists, movements, countMovements, hasMoreMovements, loadMoreMovements, auditLogs, pendingWrites, loading, inventoryError, movementsLoading, movementsError, settingsLoading, settingsError, personnelMessage, retryInventory } = useInventoryData(
    !!user,
    baseRole === "admin" && !DEMO_MODE && tab === "settings",
    tab === "movements"
  );
  const role = DEMO_MODE ? "admin" as const : roleForEmail(user?.email, { dynamicOperator, pharmacists });
  const online = useOnline();

  const today = useMemo(() => new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), []);
  const activeMeds = useMemo(() => activeMedicines(medicines), [medicines]);
  const activePharmacists = useMemo(() => pharmacists.filter((p) => p.active !== false), [pharmacists]);
  const modalMeds = useMemo(() => {
    if (modal?.kind === "movement" && modal.editing?.medicineId) {
      const med = medicines.find((m) => m.id === modal.editing!.medicineId);
      if (med && !activeMeds.some((m) => m.id === med.id)) return [...activeMeds, med];
    }
    return activeMeds;
  }, [activeMeds, medicines, modal]);
  const modalPharmacists = useMemo(() => {
    if (modal?.kind === "movement" && modal.editing?.pharmacistEmail) {
      const email = modal.editing.pharmacistEmail.trim().toLowerCase();
      const pharm = pharmacists.find((p) => p.email.trim().toLowerCase() === email);
      if (pharm && !activePharmacists.some((p) => p.id === pharm.id)) return [...activePharmacists, pharm];
    }
    return activePharmacists;
  }, [activePharmacists, pharmacists, modal]);
  const pharmacistNames = useMemo(() => pharmacistNameByEmail(pharmacists), [pharmacists]);
  const expAlert = useMemo(() => summarizeInventory(activeMeds), [activeMeds]);
  const lastCounts = useMemo(() => lastCountMovementByMedicine(countMovements ?? movements), [countMovements, movements]);
  const lastCountAtByMedicine = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, record] of lastCounts) map.set(id, record.createdAt);
    for (const m of medicines) {
      if (m.lastCountAt && (!map.has(m.id) || m.lastCountAt > map.get(m.id)!)) map.set(m.id, m.lastCountAt);
    }
    return map;
  }, [lastCounts, medicines]);
  const certifications = useMemo(() => {
    const map = new Map<string, { createdAt: string; pharmacistName: string }>();
    for (const [id, record] of lastCounts) {
      map.set(id, {
        createdAt: record.createdAt,
        pharmacistName: pharmacistNames.get(record.pharmacistEmail.trim().toLowerCase()) || record.pharmacistEmail,
      });
    }
    for (const m of medicines) {
      if (!m.lastCountAt) continue;
      const existing = map.get(m.id);
      if (!existing || m.lastCountAt >= existing.createdAt) {
        const email = (m.lastCountBy ?? "").trim();
        map.set(m.id, {
          createdAt: m.lastCountAt,
          pharmacistName: pharmacistNames.get(email.toLowerCase()) || email || "Registrado",
        });
      }
    }
    return map;
  }, [lastCounts, medicines, pharmacistNames]);

  const closeModal = useCallback(() => { setModal(null); setModalError(null); }, []);
  const openCreate = useCallback((kind: "medicine" | "pharmacist" | "movement") => {
    setModalError(null);
    setModal(kind === "movement" ? { kind: "movement" } : kind === "medicine" ? { kind: "medicine", editing: null } : { kind: "pharmacist", editing: null });
  }, []);
  const openEdit = useCallback((kind: "medicine" | "pharmacist", item: Medicine | Pharmacist) => {
    setModalError(null);
    setModal(kind === "medicine" ? { kind: "medicine", editing: item as Medicine } : { kind: "pharmacist", editing: item as Pharmacist });
  }, []);
  const openMovement = useCallback((medicineId?: string, type?: MovementType) => { setModalError(null); setModal({ kind: "movement", medicineId, type }); }, []);
  const openEditMovement = useCallback((movement: Movement) => {
    setModalError(null);
    const resolvedMedId = movement.medicineId || medicines.find((m) => m.name === movement.medicineName)?.id || "";
    setModal({
      kind: "movement",
      medicineId: resolvedMedId,
      type: movement.type === "IN" ? "IN" : "OUT",
      editing: { ...movement, medicineId: resolvedMedId },
    });
  }, [medicines]);
  const openCount = useCallback((medicineId: string) => { setModalError(null); setModal({ kind: "count", medicineId }); }, []);
  const viewMedicineMovements = useCallback((medicineId: string) => { setMovementMedicineId(medicineId); setTab("movements"); }, []);
  const changeTab = useCallback((next: "dashboard" | "movements" | "settings") => { if (next === "movements") setMovementMedicineId(""); setTab(next); }, []);

  const flash = useCallback((message: string, critical = false) => setNotice({ message, critical }), []);
  useEffect(() => {
    if (!notice || notice.critical) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!user || !canOperateInventory(role)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || modal || deactivation || voiding) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "/") { e.preventDefault(); setTab("dashboard"); requestAnimationFrame(() => searchRef.current?.focus()); }
      else if (e.key === "n" || e.key === "N") { if (activeMeds.length) { e.preventDefault(); openMovement(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, role, modal, deactivation, voiding, activeMeds.length, openMovement]);

  const exportMedicines = useCallback((items: Medicine[]) => {
    if (!items.length) { flash("No hay medicamentos para exportar"); return; }
    downloadTextFile(`inventario_vista_${dateStamp()}.csv`, inventoryViewToCsv(items));
    flash(`Vista exportada: ${items.length} medicamentos`);
  }, [flash]);

  const backupDatabase = useCallback(async () => {
    try {
      const backup = await dataApi.exportDatabaseBackup();
      downloadTextFile(`respaldo_base_datos_${dateStamp()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8;");
      flash("Copia completa descargada en JSON");
    } catch (err) {
      flash(err instanceof Error ? err.message : "No se pudo descargar el respaldo", true);
    }
  }, [flash]);

  const resetDatabase = useCallback(async (confirm: string) => {
    try {
      await dataApi.resetDatabase(confirm);
      retryInventory();
      flash("Base de datos limpia y lista para iniciar registros");
    } catch (err) {
      flash(err instanceof Error ? err.message : "No se pudo limpiar la base de datos", true);
      throw err;
    }
  }, [flash, retryInventory]);

  const setActive = useCallback(async (col: "medicines" | "pharmacists", id: string, active: boolean, label: string) => {
    if (!active) { setDeactivation({ col, id, label }); return; }
    try { await dataApi.setActive(col, id, true); flash("Reactivado correctamente"); }
    catch { flash("No se pudo actualizar", true); }
  }, [flash]);

  const confirmDeactivation = useCallback(async () => {
    if (!deactivation) return;
    setBusy(true);
    try { await dataApi.setActive(deactivation.col, deactivation.id, false); flash("Dado de baja correctamente"); setDeactivation(null); }
    catch { flash("No se pudo actualizar", true); }
    finally { setBusy(false); }
  }, [deactivation, flash]);

  const openVoidMovement = useCallback((movement: Movement) => { setVoidError(null); setVoiding(movement); }, []);
  const confirmVoidMovement = useCallback(async (reason: string) => {
    if (!voiding) return;
    setBusy(true);
    setVoidError(null);
    try {
      await dataApi.voidMovement({ movementId: voiding.id, reason, now: new Date().toISOString() });
      flash("Egreso anulado; la cantidad se reintegró al inventario");
      setVoiding(null);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "No se pudo anular el egreso");
    } finally {
      setBusy(false);
    }
  }, [voiding, flash]);

  const submit = useCallback(async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setBusy(true);
    setModalError(null);
    const form = new FormData(e.currentTarget);
    const now = new Date().toISOString();
    try {
      if (action === "medicine") await saveMedicine(form, modal?.kind === "medicine" ? modal.editing : null);
      else if (action === "pharmacist") await savePharmacist(form, modal?.kind === "pharmacist" ? modal.editing : null);
      else if (action === "movement") await saveMovement(form, now, modal?.kind === "movement" ? modal.editing ?? null : null);
      else if (action === "count") await saveCount(form, now, modal?.kind === "count" ? medicines.find((m) => m.id === modal.medicineId) : undefined);
      flash(action === "count" ? "Saldo confirmado correctamente" : "Registro guardado correctamente");
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar";
      setModalError({ message, field: fieldForFormError(action, message) });
    } finally {
      setBusy(false);
    }
  }, [modal, medicines, flash, closeModal]);

  if (!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if (!user) return <Login />;
  if (!canOperateInventory(role)) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">Rx</div><h1>Acceso no autorizado</h1><p>Tu cuenta no tiene un rol habilitado para este piloto.</p><button className="primary" onClick={() => void signOut(auth)}>Cerrar sesión</button></div></div>;

  return <main className="app-shell">
    <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
    <Sidebar email={user.email || ""} tab={tab} onTab={changeTab} onSignOut={() => void signOut(auth)} demo={DEMO_MODE} role={role} />
    <div className="workspace">
      <WorkspaceHeader demo={DEMO_MODE} pilot={PILOT_MODE} />
      <section className="content" id="contenido-principal" tabIndex={-1}>
        {DEMO_MODE && <div className="demo-banner" role="status"><strong>Modo demostración</strong><span>Datos ficticios · los cambios solo permanecen durante esta sesión</span></div>}
        {!DEMO_MODE && PILOT_MODE && <div className="pilot-banner" role="status"><strong>Piloto controlado</strong><span>Uso limitado a personal autorizado · reporte cualquier incidente antes de continuar</span></div>}
        <ConnectionBanner online={online} pendingWrites={pendingWrites} />
        {!alertDismissed && <ExpiryAlert summary={expAlert} showViewButton={tab !== "dashboard"} onView={() => { setTab("dashboard"); setAlertDismissed(true); }} onDismiss={() => setAlertDismissed(true)} />}
        <PageHeader eyebrow={today} title={tab === "dashboard" ? "Inventario de medicamentos" : tab === "movements" ? "Historial de movimientos" : "Configuración"} description={tab === "dashboard" ? "Existencias disponibles y alertas de control" : tab === "movements" ? "Trazabilidad de ingresos y egresos por prescripción." : "Administre el catálogo y el personal autorizado."} action={tab !== "settings" ? <button className="primary" onClick={() => openMovement()} disabled={!activeMeds.length}><Icon name="plus" size={16} /> Registrar movimiento</button> : undefined} />

        {tab === "dashboard" && <InventoryPanel medicines={activeMeds} certifications={certifications} searchRef={searchRef} loading={loading} error={inventoryError} onRetry={retryInventory} onMovement={openMovement} onCount={openCount} onViewMovements={viewMedicineMovements} onExport={exportMedicines} />}

        {tab === "movements" && <MovementsTab movements={movements} medicines={medicines} pharmacistNames={pharmacistNames} onNotice={flash} onEditMovement={openEditMovement} onVoidMovement={openVoidMovement} loading={movementsLoading} error={movementsError} onRetry={retryInventory} initialMedicineId={movementMedicineId} onMedicineFilterChange={setMovementMedicineId} hasMore={hasMoreMovements} onLoadMore={loadMoreMovements} />}

        {tab === "settings" && canManageCatalog(role) && <SettingsTab medicines={medicines} pharmacists={pharmacists} auditLogs={auditLogs} loading={settingsLoading} error={settingsError} onRetry={retryInventory} onCreate={openCreate} onEdit={openEdit} onSetActive={setActive} onMovement={openMovement} onCount={openCount} onBackupDatabase={backupDatabase} onResetDatabase={resetDatabase} />}
      </section>
    </div>

    {notice && <div className={`toast${notice.critical ? " toast-critical" : ""}`} role={notice.critical ? "alert" : "status"}>{notice.message}{notice.critical && <button type="button" onClick={() => setNotice(null)} aria-label="Descartar mensaje"><Icon name="close" size={18} /></button>}</div>}
    {modal && (modal.kind === "count"
      ? <CountModal medicine={medicines.find((m) => m.id === modal.medicineId)} activePharmacists={activePharmacists} personnelMessage={personnelMessage} busy={busy} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit} onAdjust={openMovement} />
      : <Modals state={modal} activeMeds={modalMeds} activePharmacists={modalPharmacists} personnelMessage={personnelMessage} lastCountAtByMedicine={lastCountAtByMedicine} busy={busy} online={online} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit} />)}
    {voiding && <VoidMovementDialog movement={voiding} unit={medicines.find((m) => m.id === voiding.medicineId)?.unit} lastCountAt={voiding.medicineId ? lastCountAtByMedicine.get(voiding.medicineId) : undefined} busy={busy} error={voidError} onCancel={() => setVoiding(null)} onConfirm={(reason) => void confirmVoidMovement(reason)} />}
    {deactivation && <ConfirmDialog label={deactivation.label} busy={busy} onCancel={() => setDeactivation(null)} onConfirm={() => void confirmDeactivation()} />}
  </main>;
}
