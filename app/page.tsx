"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { activeMedicines, pharmacistNameByEmail, type Medicine, type MovementType, type Pharmacist } from "./lib/inventory";
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

async function saveMovement(form: FormData, now: string) {
  const parsed = parseMovementForm(form);
  await dataApi.registerMovement({ ...parsed, now });
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
  const [alertDismissed, setAlertDismissed] = useState(false);

  const { medicines, pharmacists, movements, countMovements, hasMoreMovements, loadMoreMovements, auditLogs, pendingWrites, loading, inventoryError, movementsLoading, movementsError, settingsLoading, settingsError, personnelMessage, retryInventory } = useInventoryData(!!user, baseRole === "admin" && !DEMO_MODE);
  const role = DEMO_MODE ? "admin" as const : roleForEmail(user?.email, { dynamicOperator, pharmacists });
  const online = useOnline();

  const today = useMemo(() => new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), []);
  const activeMeds = useMemo(() => activeMedicines(medicines), [medicines]);
  const activePharmacists = useMemo(() => pharmacists.filter((p) => p.active !== false), [pharmacists]);
  const pharmacistNames = useMemo(() => pharmacistNameByEmail(pharmacists), [pharmacists]);
  const expAlert = useMemo(() => summarizeInventory(activeMeds), [activeMeds]);
  const lastCounts = useMemo(() => lastCountMovementByMedicine(countMovements ?? movements), [countMovements, movements]);
  const certifications = useMemo(() => new Map([...lastCounts].map(([id, record]) => [id, { createdAt: record.createdAt, pharmacistName: pharmacistNames.get(record.pharmacistEmail.trim().toLowerCase()) || record.pharmacistEmail }])), [lastCounts, pharmacistNames]);

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
      if (e.ctrlKey || e.metaKey || e.altKey || modal || deactivation) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === "/") { e.preventDefault(); setTab("dashboard"); requestAnimationFrame(() => searchRef.current?.focus()); }
      else if (e.key === "n" || e.key === "N") { if (activeMeds.length) { e.preventDefault(); openMovement(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, role, modal, deactivation, activeMeds.length, openMovement]);

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

  const submit = useCallback(async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setBusy(true);
    setModalError(null);
    const form = new FormData(e.currentTarget);
    const now = new Date().toISOString();
    try {
      if (action === "medicine") await saveMedicine(form, modal?.kind === "medicine" ? modal.editing : null);
      else if (action === "pharmacist") await savePharmacist(form, modal?.kind === "pharmacist" ? modal.editing : null);
      else if (action === "movement") await saveMovement(form, now);
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

        {tab === "movements" && <MovementsTab movements={movements} medicines={medicines} pharmacistNames={pharmacistNames} onNotice={flash} loading={movementsLoading} error={movementsError} onRetry={retryInventory} initialMedicineId={movementMedicineId} onMedicineFilterChange={setMovementMedicineId} hasMore={hasMoreMovements} onLoadMore={loadMoreMovements} />}

        {tab === "settings" && canManageCatalog(role) && <SettingsTab medicines={medicines} pharmacists={pharmacists} auditLogs={auditLogs} loading={settingsLoading} error={settingsError} onRetry={retryInventory} onCreate={openCreate} onEdit={openEdit} onSetActive={setActive} onMovement={openMovement} onCount={openCount} onBackupDatabase={backupDatabase} onResetDatabase={resetDatabase} />}
      </section>
    </div>

    {notice && <div className={`toast${notice.critical ? " toast-critical" : ""}`} role={notice.critical ? "alert" : "status"}>{notice.message}{notice.critical && <button type="button" onClick={() => setNotice(null)} aria-label="Descartar mensaje"><Icon name="close" size={18} /></button>}</div>}
    {modal && (modal.kind === "count"
      ? <CountModal medicine={medicines.find((m) => m.id === modal.medicineId)} activePharmacists={activePharmacists} personnelMessage={personnelMessage} busy={busy} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit} onAdjust={openMovement} />
      : <Modals state={modal} activeMeds={activeMeds} activePharmacists={activePharmacists} personnelMessage={personnelMessage} busy={busy} online={online} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit} />)}
    {deactivation && <ConfirmDialog label={deactivation.label} busy={busy} onCancel={() => setDeactivation(null)} onConfirm={() => void confirmDeactivation()} />}
  </main>;
}
