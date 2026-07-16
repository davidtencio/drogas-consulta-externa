"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import { activeMedicines, expiringCount, expirySummary, filterMedicines, lowStockCount, pharmacistNameByEmail, totalStock, type Medicine, type MovementType, type Pharmacist } from "./lib/inventory";
import { medicinesToCsv } from "./lib/csv";
import { dateStamp, downloadTextFile } from "./lib/download";
import * as dataApi from "./lib/db";
import { useInventoryData } from "./hooks/useInventoryData";
import { useOnline } from "./hooks/useOnline";
import { Sidebar } from "./components/Sidebar";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ExpiryAlert } from "./components/ExpiryAlert";
import { StatsBar } from "./components/StatsBar";
import { MovementsTab } from "./components/MovementsTab";
import { MedicineCard } from "./components/MedicineCard";
import { SettingsTab } from "./components/SettingsTab";
import { Modals, type ModalState } from "./components/Modals";
import { CountModal } from "./components/CountModal";

/** Estado de modal de la app: los diálogos de Modals más el conteo físico. */
type AppModal = ModalState | { kind: "count"; medicineId: string };

const trimmed=(form:FormData,k:string)=>String(form.get(k)||"").trim();

/** Crea o actualiza un medicamento; en creación con existencia inicial, exige farmacéutico. */
async function saveMedicine(form:FormData, now:string, editing:Medicine|null){
  const name=trimmed(form,"name"), strength=trimmed(form,"strength");
  if(!name||!strength) throw new Error("Nombre y concentración son obligatorios.");
  const fields={name,strength,form:trimmed(form,"form")||"Tableta",minimumStock:Math.max(0,Number(form.get("minimumStock"))||0),lot:trimmed(form,"lot"),expiresAt:trimmed(form,"expiresAt")};
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

/** Registra un conteo físico (arqueo) del medicamento indicado; no ajusta stock. */
async function saveCount(form:FormData, now:string, medicine:Medicine|undefined){
  if(!medicine) throw new Error("Medicamento no disponible.");
  const countedQuantity=Number(form.get("countedQuantity"));
  const pharmacistEmail=trimmed(form,"pharmacistEmail");
  if(!Number.isInteger(countedQuantity)||countedQuantity<0) throw new Error("La cantidad contada debe ser un número entero (0 o más).");
  if(!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable.");
  await dataApi.registerCount({medicine:{name:medicine.name,stock:medicine.stock},medicineId:medicine.id,countedQuantity,note:trimmed(form,"note"),pharmacistEmail,now});
}

export function Login(){
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function google(){
    setBusy(true);setError("");
    try{await signInWithPopup(auth,new GoogleAuthProvider())}
    catch(e){const code=(e as {code?:string}).code;if(code!=="auth/popup-closed-by-user"&&code!=="auth/cancelled-popup-request")setError("No se pudo iniciar sesión. Intente de nuevo.")}
    finally{setBusy(false)}
  }
  return <div className="auth-screen"><div className="auth-card">
    <span className="brand-mark">Rx</span>
    <h1>Control de Drogas</h1>
    <p>Consulta externa · acceso autorizado</p>
    {error&&<div className="auth-error">{error}</div>}
    <button className="google-btn" onClick={google} disabled={busy}>
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/><path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-2.9.7-4.3l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.4l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.7-3.7-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
      {busy?"Conectando...":"Continuar con Google"}
    </button>
    <small className="auth-note">Solo personal farmacéutico autorizado.</small>
  </div></div>;
}

export default function Home() {
  const [user,setUser]=useState<User|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [tab,setTab]=useState<"dashboard"|"movements"|"settings">("dashboard");
  const [query,setQuery]=useState("");
  const [modal,setModal]=useState<AppModal|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [alertDismissed,setAlertDismissed]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true)}),[]);

  const {medicines,pharmacists,movements,pendingWrites}=useInventoryData(!!user);
  const online=useOnline();

  const today=useMemo(()=>new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(),[]);
  const activeMeds=useMemo(()=>activeMedicines(medicines),[medicines]);
  const activePharmacists=useMemo(()=>pharmacists.filter(p=>p.active!==false),[pharmacists]);
  const pharmacistNames=useMemo(()=>pharmacistNameByEmail(pharmacists),[pharmacists]);
  const filtered=useMemo(()=>filterMedicines(activeMeds,query),[activeMeds,query]);
  const total=totalStock(activeMeds), low=lowStockCount(activeMeds);
  const expiring=useMemo(()=>expiringCount(activeMeds),[activeMeds]);
  const expAlert=useMemo(()=>expirySummary(medicines),[medicines]);

  const closeModal=useCallback(()=>setModal(null),[]);
  const openCreate=useCallback((kind:"medicine"|"pharmacist"|"movement")=>{
    setModal(kind==="movement"?{kind:"movement"}:kind==="medicine"?{kind:"medicine",editing:null}:{kind:"pharmacist",editing:null});
  },[]);
  const openEdit=useCallback((kind:"medicine"|"pharmacist",item:Medicine|Pharmacist)=>{
    setModal(kind==="medicine"?{kind:"medicine",editing:item as Medicine}:{kind:"pharmacist",editing:item as Pharmacist});
  },[]);
  const openMovement=useCallback((medicineId?:string,type?:MovementType)=>{setModal({kind:"movement",medicineId,type})},[]);
  const openCount=useCallback((medicineId:string)=>{setModal({kind:"count",medicineId})},[]);

  const flash=useCallback((msg:string)=>{setNotice(msg);setTimeout(()=>setNotice(""),4000)},[]);

  const exportMedicines=useCallback(()=>{
    if(!medicines.length){flash("No hay medicamentos para exportar");return}
    downloadTextFile(`inventario_${dateStamp()}.csv`,medicinesToCsv(medicines));
    flash("Inventario exportado");
  },[medicines,flash]);

  const setActive=useCallback(async(col:"medicines"|"pharmacists",id:string,active:boolean,label:string)=>{
    if(!active&&!window.confirm(`¿Dar de baja "${label}"? Podrá reactivarlo luego.`)) return;
    try{await dataApi.setActive(col,id,active);flash(active?"Reactivado correctamente":"Dado de baja correctamente")}
    catch{flash("No se pudo actualizar")}
  },[flash]);

  const submit=useCallback(async(e:FormEvent<HTMLFormElement>, action:string)=>{
    e.preventDefault();setBusy(true);
    const form=new FormData(e.currentTarget);
    const now=new Date().toISOString();
    try{
      if(action==="medicine") await saveMedicine(form,now,modal?.kind==="medicine"?modal.editing:null);
      else if(action==="pharmacist") await savePharmacist(form,now,modal?.kind==="pharmacist"?modal.editing:null);
      else if(action==="movement") await saveMovement(form,now);
      else if(action==="count") await saveCount(form,now,modal?.kind==="count"?medicines.find(m=>m.id===modal.medicineId):undefined);
      flash(action==="count"?"Conteo registrado correctamente":"Registro guardado correctamente");closeModal();
    }catch(err){flash(err instanceof Error?err.message:"No se pudo guardar")}
    finally{setBusy(false)}
  },[modal,medicines,flash,closeModal]);

  if(!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if(!user) return <Login/>;

  return <main className="app-shell">
    <Sidebar email={user.email||""} tab={tab} onTab={setTab} onSignOut={()=>void signOut(auth)}/>
    <section className="content">
      <ConnectionBanner online={online} pendingWrites={pendingWrites}/>
      {!alertDismissed&&<ExpiryAlert summary={expAlert} showViewButton={tab!=="dashboard"} onView={()=>{setTab("dashboard");setAlertDismissed(true)}} onDismiss={()=>setAlertDismissed(true)}/>}
      <header><div><p className="eyebrow">{today}</p><h1>{tab==="dashboard"?"Inventario de medicamentos":tab==="movements"?"Historial de movimientos":"Configuración"}</h1><p>{tab==="dashboard"?"Vista actualizada de las existencias disponibles.":tab==="movements"?"Trazabilidad de ingresos y egresos por prescripción.":"Administre el catálogo y el personal autorizado."}</p></div>{tab!=="settings"&&<button className="primary" onClick={()=>openMovement()} disabled={!activeMeds.length}>＋ Registrar movimiento</button>}</header>

      {tab==="dashboard"&&<>
        <StatsBar total={total} low={low} expiring={expiring} recent={Math.min(movements.length,8)}/>
        <div className="toolbar"><label><span>⌕</span><input aria-label="Buscar medicamentos" placeholder="Buscar por medicamento o concentración..." value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="toolbar-end"><span>{filtered.length} medicamentos</span><button className="secondary" onClick={exportMedicines} disabled={!medicines.length}>⭳ Exportar CSV</button></div></div>
        {activeMeds.length?<div className="medicine-grid">{filtered.map(m=><MedicineCard key={m.id} medicine={m} onMovement={type=>openMovement(m.id,type)} onCount={()=>openCount(m.id)}/>)}</div>:<div className="panel"><div className="empty-block">Aún no hay medicamentos activos. Agréguelos en Configuración.</div></div>}
      </>}

      {tab==="movements"&&<MovementsTab movements={movements} pharmacistNames={pharmacistNames} onNotice={flash}/>}

      {tab==="settings"&&<SettingsTab medicines={medicines} pharmacists={pharmacists} onCreate={openCreate} onEdit={openEdit} onSetActive={setActive} onMovement={openMovement} onCount={openCount}/>}
    </section>

    {notice&&<div className="toast" role="status">{notice}</div>}
    {modal&&(modal.kind==="count"
      ? <CountModal medicine={medicines.find(m=>m.id===modal.medicineId)} activePharmacists={activePharmacists} busy={busy} onClose={closeModal} onSubmit={submit}/>
      : <Modals state={modal} activeMeds={activeMeds} activePharmacists={activePharmacists} busy={busy} online={online} onClose={closeModal} onSubmit={submit}/>)}
  </main>;
}
