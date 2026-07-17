"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { activeMedicines, expiringCount, expirySummary, filterMedicines, isValidMedicineCode, lowStockCount, pharmacistNameByEmail, totalStock, type Medicine, type MovementType, type Pharmacist } from "./lib/inventory";
import { medicinesToCsv } from "./lib/csv";
import { lastCountByMedicine } from "./lib/movements";
import { dateStamp, downloadTextFile } from "./lib/download";
import * as dataApi from "./lib/db";
import { useInventoryData } from "./hooks/useInventoryData";
import { useOnline } from "./hooks/useOnline";
import { useAuthUser } from "./hooks/useAuthUser";
import { Login } from "./components/Login";
import { Sidebar } from "./components/Sidebar";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ExpiryAlert } from "./components/ExpiryAlert";
import { StatsBar } from "./components/StatsBar";
import { MovementsTab } from "./components/MovementsTab";
import { MedicineCard } from "./components/MedicineCard";
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

const trimmed=(form:FormData,k:string)=>String(form.get(k)||"").trim();

/** Crea o actualiza un medicamento; en creación con existencia inicial, exige farmacéutico. */
async function saveMedicine(form:FormData, now:string, editing:Medicine|null){
  const name=trimmed(form,"name"), strength=trimmed(form,"strength");
  if(!name||!strength) throw new Error("Nombre y concentración son obligatorios.");
  const code=trimmed(form,"code");
  if(code&&!isValidMedicineCode(code)) throw new Error("El código debe tener el formato 000-00-0000.");
  const fields={name,strength,form:trimmed(form,"form")||"Tableta",minimumStock:Math.max(0,Number(form.get("minimumStock"))||0),lot:trimmed(form,"lot"),expiresAt:trimmed(form,"expiresAt"),code};
  if(editing){await dataApi.updateMedicine(editing.id,fields);return}
  const initial=Math.max(0,Number(form.get("stock"))||0);
  const pharmacistEmail=trimmed(form,"pharmacistEmail");
  if(initial>0){
    if(!Number.isInteger(initial)) throw new Error("La existencia inicial debe ser un número entero.");
    if(!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable del ingreso inicial.");
  }
  await dataApi.createMedicine(fields,initial,pharmacistEmail,now);
}

/** Crea o actualiza un farmacéutico autorizado. */
async function savePharmacist(form:FormData, now:string, editing:Pharmacist|null){
  const name=trimmed(form,"name"), email=trimmed(form,"email").toLowerCase(), license=trimmed(form,"license");
  if(!name||!email||!license) throw new Error("Complete todos los datos del farmacéutico.");
  if(editing) await dataApi.updatePharmacist(editing.id,{name,email,license});
  else await dataApi.createPharmacist({name,email,license},now);
}

/** Registra un movimiento (ingreso/egreso) con el farmacéutico responsable. */
async function saveMovement(form:FormData, now:string){
  const medicineId=trimmed(form,"medicineId");
  const quantity=Number(form.get("quantity"));
  const type=form.get("type")==="IN"?"IN":"OUT";
  const pharmacistEmail=trimmed(form,"pharmacistEmail");
  if(!medicineId) throw new Error("Cantidad inválida.");
  if(!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable.");
  await dataApi.registerMovement({medicineId,type,quantity,prescriptionRef:trimmed(form,"prescriptionRef"),pharmacistEmail,now});
}

/** Confirma el saldo (conteo físico = sistema) del medicamento; no ajusta stock. */
async function saveCount(form:FormData, now:string, medicine:Medicine|undefined){
  if(!medicine) throw new Error("Medicamento no disponible.");
  const pharmacistEmail=trimmed(form,"pharmacistEmail");
  if(!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable.");
  await dataApi.registerCount({medicine:{name:medicine.name,stock:medicine.stock},medicineId:medicine.id,countedQuantity:medicine.stock,note:trimmed(form,"note")||"Saldo confirmado",pharmacistEmail,now});
}

export default function Home() {
  const {user,authReady}=useAuthUser();
  const role=DEMO_MODE?"admin" as const:roleForEmail(user?.email);
  const [tab,setTab]=useState<"dashboard"|"movements"|"settings">("dashboard");
  const [query,setQuery]=useState("");
  const [modal,setModal]=useState<AppModal|null>(null);
  const [notice,setNotice]=useState<{message:string;critical:boolean}|null>(null);
  const [modalError,setModalError]=useState<FormIssue|null>(null);
  const [deactivation,setDeactivation]=useState<Deactivation|null>(null);
  const [busy,setBusy]=useState(false);
  const [alertDismissed,setAlertDismissed]=useState(false);

  const {medicines,pharmacists,movements,auditLogs,pendingWrites}=useInventoryData(!!user,role==="admin"&&!DEMO_MODE);
  const online=useOnline();

  const today=useMemo(()=>new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(),[]);
  const activeMeds=useMemo(()=>activeMedicines(medicines),[medicines]);
  const activePharmacists=useMemo(()=>pharmacists.filter(p=>p.active!==false),[pharmacists]);
  const pharmacistNames=useMemo(()=>pharmacistNameByEmail(pharmacists),[pharmacists]);
  const filtered=useMemo(()=>filterMedicines(activeMeds,query),[activeMeds,query]);
  const total=totalStock(activeMeds), low=lowStockCount(activeMeds);
  const expiring=useMemo(()=>expiringCount(activeMeds),[activeMeds]);
  const expAlert=useMemo(()=>expirySummary(medicines),[medicines]);
  const lastCounts=useMemo(()=>lastCountByMedicine(movements),[movements]);

  const closeModal=useCallback(()=>{setModal(null);setModalError(null)},[]);
  const openCreate=useCallback((kind:"medicine"|"pharmacist"|"movement")=>{
    setModalError(null);setModal(kind==="movement"?{kind:"movement"}:kind==="medicine"?{kind:"medicine",editing:null}:{kind:"pharmacist",editing:null});
  },[]);
  const openEdit=useCallback((kind:"medicine"|"pharmacist",item:Medicine|Pharmacist)=>{
    setModalError(null);setModal(kind==="medicine"?{kind:"medicine",editing:item as Medicine}:{kind:"pharmacist",editing:item as Pharmacist});
  },[]);
  const openMovement=useCallback((medicineId?:string,type?:MovementType)=>{setModalError(null);setModal({kind:"movement",medicineId,type})},[]);
  const openCount=useCallback((medicineId:string)=>{setModalError(null);setModal({kind:"count",medicineId})},[]);

  const flash=useCallback((message:string,critical=false)=>setNotice({message,critical}),[setNotice]);
  useEffect(()=>{
    if(!notice||notice.critical) return;
    const timer=window.setTimeout(()=>setNotice(null),4000);
    return ()=>window.clearTimeout(timer);
  },[notice]);

  const exportMedicines=useCallback(()=>{
    if(!medicines.length){flash("No hay medicamentos para exportar");return}
    downloadTextFile(`inventario_${dateStamp()}.csv`,medicinesToCsv(medicines));
    flash("Inventario exportado");
  },[medicines,flash]);

  const setActive=useCallback(async(col:"medicines"|"pharmacists",id:string,active:boolean,label:string)=>{
    if(!active){setDeactivation({col,id,label});return}
    try{await dataApi.setActive(col,id,true);flash("Reactivado correctamente")}
    catch{flash("No se pudo actualizar",true)}
  },[flash,setDeactivation]);

  const confirmDeactivation=useCallback(async()=>{
    if(!deactivation) return;
    setBusy(true);
    try{await dataApi.setActive(deactivation.col,deactivation.id,false);flash("Dado de baja correctamente");setDeactivation(null)}
    catch{flash("No se pudo actualizar",true)}finally{setBusy(false)}
  },[deactivation,flash,setDeactivation]);

  const submit=useCallback(async(e:FormEvent<HTMLFormElement>, action:string)=>{
    e.preventDefault();setBusy(true);setModalError(null);
    const form=new FormData(e.currentTarget);
    const now=new Date().toISOString();
    try{
      if(action==="medicine") await saveMedicine(form,now,modal?.kind==="medicine"?modal.editing:null);
      else if(action==="pharmacist") await savePharmacist(form,now,modal?.kind==="pharmacist"?modal.editing:null);
      else if(action==="movement") await saveMovement(form,now);
      else if(action==="count") await saveCount(form,now,modal?.kind==="count"?medicines.find(m=>m.id===modal.medicineId):undefined);
      flash(action==="count"?"Saldo confirmado correctamente":"Registro guardado correctamente");closeModal();
    }catch(err){
      const message=err instanceof Error?err.message:"No se pudo guardar";
      const lower=message.toLowerCase();
      const field=lower.includes("código")?"code":lower.includes("concentración")?"strength":lower.includes("nombre")?"name":lower.includes("existencia")?"stock":lower.includes("cantidad")?"quantity":lower.includes("medicamento")?"medicineId":lower.includes("farmacéutico")?"pharmacistEmail":undefined;
      setModalError({message,field});
    }
    finally{setBusy(false)}
  },[modal,medicines,flash,closeModal]);

  if(!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if(!user) return <Login/>;
  if(!canOperateInventory(role)) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark">Rx</div><h1>Acceso no autorizado</h1><p>Tu cuenta no tiene un rol habilitado para este piloto.</p><button className="primary" onClick={()=>void signOut(auth)}>Cerrar sesión</button></div></div>;

  return <main className="app-shell">
    <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
    <Sidebar email={user.email||""} tab={tab} onTab={setTab} onSignOut={()=>void signOut(auth)} demo={DEMO_MODE} role={role}/>
    <section className="content" id="contenido-principal" tabIndex={-1}>
      {DEMO_MODE&&<div className="demo-banner" role="status"><strong>Modo demostración</strong><span>Datos ficticios · los cambios solo permanecen durante esta sesión</span></div>}
      {!DEMO_MODE&&PILOT_MODE&&<div className="pilot-banner" role="status"><strong>Piloto controlado</strong><span>Uso limitado a personal autorizado · reporte cualquier incidente antes de continuar</span></div>}
      <ConnectionBanner online={online} pendingWrites={pendingWrites}/>
      {!alertDismissed&&<ExpiryAlert summary={expAlert} showViewButton={tab!=="dashboard"} onView={()=>{setTab("dashboard");setAlertDismissed(true)}} onDismiss={()=>setAlertDismissed(true)}/>}
      <header><div><p className="eyebrow">{today}</p><h1>{tab==="dashboard"?"Inventario de medicamentos":tab==="movements"?"Historial de movimientos":"Configuración"}</h1><p>{tab==="dashboard"?"Existencias disponibles y alertas de control":tab==="movements"?"Trazabilidad de ingresos y egresos por prescripción.":"Administre el catálogo y el personal autorizado."}</p></div>{tab!=="settings"&&<button className="primary" onClick={()=>openMovement()} disabled={!activeMeds.length}>＋ Registrar movimiento</button>}</header>

      {tab==="dashboard"&&<>
        <StatsBar total={total} low={low} expiring={expiring} recent={Math.min(movements.length,8)}/>
        <div className="toolbar"><label><span>⌕</span><input aria-label="Buscar medicamentos" placeholder="Buscar medicamento, concentración, código o lote…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="toolbar-end"><span>{filtered.length} medicamentos</span><button className="secondary" onClick={exportMedicines} disabled={!medicines.length}>⭳ Exportar CSV</button></div></div>
        {activeMeds.length?<div className="medicine-grid">{filtered.map(m=><MedicineCard key={m.id} medicine={m} lastCount={lastCounts.get(m.id)} onMovement={type=>openMovement(m.id,type)} onCount={()=>openCount(m.id)}/>)}</div>:<div className="panel"><div className="empty-block">Aún no hay medicamentos activos. Agréguelos en Configuración.</div></div>}
      </>}

      {tab==="movements"&&<MovementsTab movements={movements} medicines={medicines} pharmacistNames={pharmacistNames} onNotice={flash}/>}

      {tab==="settings"&&canManageCatalog(role)&&<SettingsTab medicines={medicines} pharmacists={pharmacists} auditLogs={auditLogs} onCreate={openCreate} onEdit={openEdit} onSetActive={setActive} onMovement={openMovement} onCount={openCount}/>}
    </section>

    {notice&&<div className={`toast${notice.critical?" toast-critical":""}`} role={notice.critical?"alert":"status"}>{notice.message}{notice.critical&&<button type="button" onClick={()=>setNotice(null)} aria-label="Descartar mensaje">×</button>}</div>}
    {modal&&(modal.kind==="count"
      ? <CountModal medicine={medicines.find(m=>m.id===modal.medicineId)} activePharmacists={activePharmacists} busy={busy} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit}/>
      : <Modals state={modal} activeMeds={activeMeds} activePharmacists={activePharmacists} busy={busy} online={online} error={modalError?.message} errorField={modalError?.field} onClose={closeModal} onSubmit={submit}/>)}
    {deactivation&&<ConfirmDialog label={deactivation.label} busy={busy} onCancel={()=>setDeactivation(null)} onConfirm={()=>void confirmDeactivation()}/>}
  </main>;
}
