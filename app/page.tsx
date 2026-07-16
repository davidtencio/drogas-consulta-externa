"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query as fbQuery, runTransaction, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { activeMedicines, expiringCount, expiryStatus, filterMedicines, isLowStock, lowStockCount, prepareMovement, sortByName, stockPercent, totalStock, type Medicine, type Pharmacist, type Movement } from "./lib/inventory";
import { medicinesToCsv, movementsToCsv } from "./lib/csv";
import { filterAndSortMovements, type MovementSort, type MovementTypeFilter } from "./lib/movements";

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
  const [medicines,setMedicines]=useState<Medicine[]>([]);
  const [pharmacists,setPharmacists]=useState<Pharmacist[]>([]);
  const [movements,setMovements]=useState<Movement[]>([]);
  const [query,setQuery]=useState("");
  const [movType,setMovType]=useState<MovementTypeFilter>("ALL");
  const [movText,setMovText]=useState("");
  const [movSort,setMovSort]=useState<MovementSort>("date-desc");
  const [modal,setModal]=useState<"movement"|"medicine"|"pharmacist"|null>(null);
  const [editing,setEditing]=useState<Medicine|Pharmacist|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true)}),[]);

  useEffect(()=>{
    if(!user) return;
    const unsubMed=onSnapshot(collection(db,"medicines"),s=>setMedicines(
      sortByName(s.docs.map(d=>({id:d.id,...d.data()} as Medicine)))
    ));
    const unsubPh=onSnapshot(collection(db,"pharmacists"),s=>setPharmacists(
      sortByName(s.docs.map(d=>({id:d.id,...d.data()} as Pharmacist)))
    ));
    const unsubMov=onSnapshot(fbQuery(collection(db,"movements"),orderBy("createdAt","desc"),limit(200)),s=>setMovements(
      s.docs.map(d=>({id:d.id,...d.data()} as Movement))
    ));
    return()=>{unsubMed();unsubPh();unsubMov()};
  },[user]);

  const today=useMemo(()=>new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(),[]);
  const activeMeds=useMemo(()=>activeMedicines(medicines),[medicines]);
  const filtered=useMemo(()=>filterMedicines(activeMeds,query),[activeMeds,query]);
  const total=totalStock(activeMeds), low=lowStockCount(activeMeds);
  const expiring=useMemo(()=>expiringCount(activeMeds),[activeMeds]);
  const visibleMovements=useMemo(()=>filterAndSortMovements(movements,{type:movType,text:movText},movSort),[movements,movType,movText,movSort]);

  const closeModal=useCallback(()=>{setModal(null);setEditing(null)},[]);
  const openCreate=useCallback((kind:"medicine"|"pharmacist"|"movement")=>{setEditing(null);setModal(kind)},[]);
  const openEdit=useCallback((kind:"medicine"|"pharmacist",item:Medicine|Pharmacist)=>{setEditing(item);setModal(kind)},[]);

  const flash=useCallback((msg:string)=>{setNotice(msg);setTimeout(()=>setNotice(""),4000)},[]);

  // Descarga un CSV en el navegador. El BOM UTF-8 permite que Excel muestre bien los acentos.
  const downloadCsv=useCallback((filename:string,content:string)=>{
    const blob=new Blob(["﻿"+content],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=filename;a.click();
    URL.revokeObjectURL(url);
  },[]);

  const stamp=()=>new Date().toISOString().slice(0,10);

  const exportMedicines=useCallback(()=>{
    if(!medicines.length){flash("No hay medicamentos para exportar");return}
    downloadCsv(`inventario_${stamp()}.csv`,medicinesToCsv(medicines));
    flash("Inventario exportado");
  },[medicines,downloadCsv,flash]);

  const exportMovements=useCallback(async()=>{
    try{
      // La vista muestra solo los últimos 8; para exportar traemos el historial completo.
      const snap=await getDocs(fbQuery(collection(db,"movements"),orderBy("createdAt","desc")));
      const all=snap.docs.map(d=>({id:d.id,...d.data()} as Movement));
      if(!all.length){flash("No hay movimientos para exportar");return}
      downloadCsv(`movimientos_${stamp()}.csv`,movementsToCsv(all));
      flash(`Movimientos exportados (${all.length})`);
    }catch{flash("No se pudo exportar los movimientos")}
  },[downloadCsv,flash]);

  const setActive=useCallback(async(col:"medicines"|"pharmacists",id:string,active:boolean,label:string)=>{
    if(!active&&!window.confirm(`¿Dar de baja "${label}"? Podrá reactivarlo luego.`)) return;
    try{await updateDoc(doc(db,col,id),{active});flash(active?"Reactivado correctamente":"Dado de baja correctamente")}
    catch{flash("No se pudo actualizar")}
  },[flash]);

  const submit=useCallback(async(e:FormEvent<HTMLFormElement>, action:string)=>{
    e.preventDefault();setBusy(true);
    const form=new FormData(e.currentTarget);
    const g=(k:string)=>String(form.get(k)||"").trim();
    const now=new Date().toISOString();
    try{
      if(action==="medicine"){
        const name=g("name"), strength=g("strength");
        if(!name||!strength) throw new Error("Nombre y concentración son obligatorios.");
        const fields={name,strength,form:g("form")||"Tableta",minimumStock:Math.max(0,Number(form.get("minimumStock"))||0),lot:g("lot"),expiresAt:g("expiresAt")};
        if(editing) await updateDoc(doc(db,"medicines",editing.id),fields);
        else await addDoc(collection(db,"medicines"),{...fields,unit:"unidades",stock:Math.max(0,Number(form.get("stock"))||0),active:true,createdAt:now});
      } else if(action==="pharmacist"){
        const name=g("name"), email=g("email").toLowerCase(), license=g("license");
        if(!name||!email||!license) throw new Error("Complete todos los datos del farmacéutico.");
        if(editing) await updateDoc(doc(db,"pharmacists",editing.id),{name,email,license});
        else await addDoc(collection(db,"pharmacists"),{name,email,license,active:true,createdAt:now});
      } else if(action==="movement"){
        const medicineId=g("medicineId");
        const quantity=Number(form.get("quantity"));
        const type=form.get("type")==="IN"?"IN":"OUT";
        if(!medicineId) throw new Error("Cantidad inválida.");
        await runTransaction(db,async tx=>{
          const ref=doc(db,"medicines",medicineId);
          const snap=await tx.get(ref);
          if(!snap.exists()) throw new Error("Medicamento no disponible.");
          const data=snap.data();
          const {nextStock:next,record}=prepareMovement({name:data.name,stock:Number(data.stock)||0},{medicineId,type,quantity,prescriptionRef:g("prescriptionRef"),pharmacistEmail:user?.email||"",createdAt:now});
          tx.update(ref,{stock:next});
          tx.set(doc(collection(db,"movements")),record);
        });
      }
      flash("Registro guardado correctamente");closeModal();
    }catch(err){flash(err instanceof Error?err.message:"No se pudo guardar")}
    finally{setBusy(false)}
  },[user,editing,flash,closeModal]);

  if(!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if(!user) return <Login/>;

  const em=editing as Medicine|null, ep=editing as Pharmacist|null;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">Rx</span><div><strong>Control de Drogas</strong><small>Consulta externa</small></div></div>
      <nav aria-label="Navegación principal">
        <button className={tab==="dashboard"?"active":""} onClick={()=>setTab("dashboard")}><span>▦</span> Inventario</button>
        <button className={tab==="movements"?"active":""} onClick={()=>setTab("movements")}><span>⇄</span> Movimientos</button>
        <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><span>⚙</span> Configuración</button>
      </nav>
      <div className="secure"><span>✓</span><div><strong>Conexión protegida</strong><small>Datos cifrados en tránsito y reposo</small></div></div>
      <div className="profile"><div className="avatar">{(user.email||"?").slice(0,2).toUpperCase()}</div><div><strong>{user.email}</strong><small>Sesión autorizada</small></div><button className="logout" onClick={()=>void signOut(auth)} aria-label="Cerrar sesión" title="Cerrar sesión">⎋</button></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">{today}</p><h1>{tab==="dashboard"?"Inventario de medicamentos":tab==="movements"?"Historial de movimientos":"Configuración"}</h1><p>{tab==="dashboard"?"Vista actualizada de las existencias disponibles.":tab==="movements"?"Trazabilidad de ingresos y egresos por prescripción.":"Administre el catálogo y el personal autorizado."}</p></div>{tab!=="settings"&&<button className="primary" onClick={()=>openCreate("movement")} disabled={!activeMeds.length}>＋ Registrar movimiento</button>}</header>

      {tab==="dashboard"&&<>
        <div className="stats"><article><span className="stat-icon blue">▤</span><div><small>Existencias totales</small><strong>{total.toLocaleString("es-CR")}</strong><em>unidades disponibles</em></div></article><article><span className="stat-icon amber">!</span><div><small>Stock bajo</small><strong>{low}</strong><em>requieren atención</em></div></article><article><span className="stat-icon red">⏱</span><div><small>Próximos a vencer</small><strong>{expiring}</strong><em>vencidos o &le;30 días</em></div></article><article><span className="stat-icon green">⇄</span><div><small>Movimientos recientes</small><strong>{Math.min(movements.length,8)}</strong><em>últimos registros</em></div></article></div>
        <div className="toolbar"><label><span>⌕</span><input aria-label="Buscar medicamentos" placeholder="Buscar por medicamento o concentración..." value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="toolbar-end"><span>{filtered.length} medicamentos</span><button className="secondary" onClick={exportMedicines} disabled={!medicines.length}>⭳ Exportar CSV</button></div></div>
        {activeMeds.length?<div className="medicine-grid">{filtered.map(m=>{const pct=stockPercent(m);const status=isLowStock(m)?"low":"ok";const exp=expiryStatus(m.expiresAt);return <article className="medicine-card" key={m.id}><div className="card-head"><span className="pill-icon">✚</span><div className="badges"><span className={`badge ${status}`}>{status==="low"?"Stock bajo":"Disponible"}</span>{exp==="vencido"&&<span className="badge expired">Vencido</span>}{exp==="por-vencer"&&<span className="badge soon">Vence pronto</span>}</div></div><h2>{m.name}</h2><p>{m.strength} · {m.form}</p><div className="stock-row"><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span></div><div className="bar"><i className={status} style={{width:`${pct}%`}}/></div><div className="meta"><span>Lote<strong>{m.lot||"—"}</strong></span><span>Vence<strong>{m.expiresAt?new Date(m.expiresAt+"T12:00:00").toLocaleDateString("es-CR",{month:"short",year:"numeric"}):"—"}</strong></span></div><button className="card-action" onClick={()=>openCreate("movement")}>Registrar movimiento <span>→</span></button></article>})}</div>:<div className="panel"><div className="empty-block">Aún no hay medicamentos activos. Agréguelos en Configuración.</div></div>}
      </>}

      {tab==="movements"&&<div className="panel"><div className="panel-title"><div><h2>Actividad reciente</h2><p>Cada operación conserva responsable, fecha y referencia.</p></div><button className="secondary" onClick={exportMovements}>⭳ Exportar CSV</button></div>
        <div className="mov-filters"><label className="search"><span>⌕</span><input aria-label="Buscar movimientos" placeholder="Buscar por medicamento o prescripción..." value={movText} onChange={e=>setMovText(e.target.value)}/></label><label>Tipo<select aria-label="Filtrar por tipo" value={movType} onChange={e=>setMovType(e.target.value as MovementTypeFilter)}><option value="ALL">Todos</option><option value="IN">Ingresos</option><option value="OUT">Egresos</option></select></label><label>Orden<select aria-label="Ordenar" value={movSort} onChange={e=>setMovSort(e.target.value as MovementSort)}><option value="date-desc">Fecha (reciente)</option><option value="date-asc">Fecha (antiguo)</option><option value="qty-desc">Cantidad (mayor)</option><option value="qty-asc">Cantidad (menor)</option></select></label><span className="mov-count">{visibleMovements.length} de {movements.length}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Prescripción</th><th>Responsable</th></tr></thead><tbody>{!movements.length?<tr><td colSpan={6} className="empty">Aún no hay movimientos registrados.</td></tr>:visibleMovements.length?visibleMovements.map(m=><tr key={m.id}><td>{new Date(m.createdAt).toLocaleString("es-CR")}</td><td><strong>{m.medicineName}</strong></td><td><span className={`type ${m.type}`}>{m.type==="IN"?"Ingreso":"Egreso"}</span></td><td>{m.quantity}</td><td>{m.prescriptionRef||"—"}</td><td>{m.pharmacistEmail}</td></tr>):<tr><td colSpan={6} className="empty">Ningún movimiento coincide con los filtros.</td></tr>}</tbody></table></div></div>}

      {tab==="settings"&&<div className="settings-grid">
        <div className="panel"><div className="panel-title"><div><h2>Medicamentos</h2><p>Catálogo del inventario.</p></div><button className="secondary" onClick={()=>openCreate("medicine")}>＋ Agregar</button></div>{medicines.length?medicines.map(m=><div className={`list-row${m.active===false?" inactive":""}`} key={m.id}><span className="mini-icon">✚</span><div><strong>{m.name}</strong><small>{m.strength} · {m.form}</small></div><span className={`tag${m.active===false?" off":""}`}>{m.active===false?"Inactivo":"Activo"}</span><div className="row-actions"><button onClick={()=>openEdit("medicine",m)}>Editar</button>{m.active===false?<button onClick={()=>setActive("medicines",m.id,true,m.name)}>Reactivar</button>:<button className="danger" onClick={()=>setActive("medicines",m.id,false,m.name)}>Dar de baja</button>}</div></div>):<div className="empty-block">Registre el primer medicamento del catálogo.</div>}</div>
        <div className="panel"><div className="panel-title"><div><h2>Farmacéuticos autorizados</h2><p>Usuarios habilitados para operar.</p></div><button className="secondary" onClick={()=>openCreate("pharmacist")}>＋ Agregar</button></div>{pharmacists.length?pharmacists.map(p=><div className={`list-row${p.active===false?" inactive":""}`} key={p.id}><span className="mini-icon person">{p.name.slice(0,2).toUpperCase()}</span><div><strong>{p.name}</strong><small>{p.email} · {p.license}</small></div><span className={`tag${p.active===false?" off":""}`}>{p.active===false?"Inactivo":"Activo"}</span><div className="row-actions"><button onClick={()=>openEdit("pharmacist",p)}>Editar</button>{p.active===false?<button onClick={()=>setActive("pharmacists",p.id,true,p.name)}>Reactivar</button>:<button className="danger" onClick={()=>setActive("pharmacists",p.id,false,p.name)}>Dar de baja</button>}</div></div>):<div className="empty-block">Registre al primer farmacéutico autorizado.</div>}</div>
      </div>}
    </section>

    {notice&&<div className="toast" role="status">{notice}</div>}
    {modal&&<div className="overlay" onMouseDown={closeModal}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={closeModal} aria-label="Cerrar">×</button>{modal==="movement"&&<><h2>Registrar movimiento</h2><p>Actualice existencias con trazabilidad completa.</p><form onSubmit={e=>submit(e,"movement")}><label>Medicamento<select name="medicineId" required>{activeMeds.map(m=><option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} disp.</option>)}</select></label><div className="form-row"><label>Tipo<select name="type"><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label><label>Cantidad<input name="quantity" type="number" min="1" required/></label></div><label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481"/></label><button className="primary full" disabled={busy}>{busy?"Guardando...":"Confirmar movimiento"}</button></form></>}{modal==="medicine"&&<><h2>{editing?"Editar medicamento":"Agregar medicamento"}</h2><p>{editing?"Las existencias solo cambian mediante movimientos.":"Defina la presentación y niveles de control."}</p><form onSubmit={e=>submit(e,"medicine")}><label>Nombre<input name="name" required placeholder="Ej. Metformina" defaultValue={em?.name||""}/></label><div className="form-row"><label>Concentración<input name="strength" required placeholder="500 mg" defaultValue={em?.strength||""}/></label><label>Forma<input name="form" placeholder="Tableta" defaultValue={em?.form||""}/></label></div><div className="form-row">{!editing&&<label>Existencia inicial<input name="stock" type="number" min="0" defaultValue="0"/></label>}<label>Stock mínimo<input name="minimumStock" type="number" min="0" defaultValue={em?String(em.minimumStock):"0"}/></label></div><div className="form-row"><label>Lote<input name="lot" defaultValue={em?.lot||""}/></label><label>Vencimiento<input name="expiresAt" type="date" defaultValue={em?.expiresAt||""}/></label></div><button className="primary full" disabled={busy}>{busy?"Guardando...":editing?"Guardar cambios":"Guardar medicamento"}</button></form></>}{modal==="pharmacist"&&<><h2>{editing?"Editar farmacéutico":"Autorizar farmacéutico"}</h2><p>El correo será su identificador de acceso.</p><form onSubmit={e=>submit(e,"pharmacist")}><label>Nombre completo<input name="name" required defaultValue={ep?.name||""}/></label><label>Correo institucional<input name="email" type="email" required defaultValue={ep?.email||""}/></label><label>Código profesional<input name="license" required placeholder="Ej. CF-1234" defaultValue={ep?.license||""}/></label><button className="primary full" disabled={busy}>{busy?"Guardando...":editing?"Guardar cambios":"Autorizar usuario"}</button></form></>}</div></div>}
  </main>;
}
