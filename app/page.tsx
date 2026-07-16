"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, runTransaction } from "firebase/firestore";
import { auth, db } from "./firebase";

type Medicine = { id:string; name:string; strength:string; form:string; unit:string; stock:number; minimumStock:number; lot:string; expiresAt:string };
type Pharmacist = { id:string; name:string; email:string; license:string };
type Movement = { id:string; type:"IN"|"OUT"; quantity:number; medicineName:string; prescriptionRef:string; pharmacistEmail:string; createdAt:string };

function Login(){
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
  const [query_,setQuery]=useState("");
  const [modal,setModal]=useState<"movement"|"medicine"|"pharmacist"|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true)}),[]);

  useEffect(()=>{
    if(!user) return;
    const unsubMed=onSnapshot(collection(db,"medicines"),s=>setMedicines(
      s.docs.map(d=>({id:d.id,...d.data()} as Medicine)).filter(m=>(m as unknown as {active?:boolean}).active!==false).sort((a,b)=>a.name.localeCompare(b.name))
    ));
    const unsubPh=onSnapshot(collection(db,"pharmacists"),s=>setPharmacists(
      s.docs.map(d=>({id:d.id,...d.data()} as Pharmacist)).sort((a,b)=>a.name.localeCompare(b.name))
    ));
    const unsubMov=onSnapshot(query(collection(db,"movements"),orderBy("createdAt","desc"),limit(8)),s=>setMovements(
      s.docs.map(d=>({id:d.id,...d.data()} as Movement))
    ));
    return()=>{unsubMed();unsubPh();unsubMov()};
  },[user]);

  const today=useMemo(()=>new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(),[]);
  const filtered=useMemo(()=>medicines.filter(m=>`${m.name} ${m.strength}`.toLowerCase().includes(query_.toLowerCase())),[medicines,query_]);
  const total=medicines.reduce((a,m)=>a+m.stock,0), low=medicines.filter(m=>m.stock<=m.minimumStock).length;

  const submit=useCallback(async(e:FormEvent<HTMLFormElement>, action:string)=>{
    e.preventDefault();setBusy(true);
    const form=new FormData(e.currentTarget);
    const g=(k:string)=>String(form.get(k)||"").trim();
    const now=new Date().toISOString();
    try{
      if(action==="medicine"){
        const name=g("name"), strength=g("strength");
        if(!name||!strength) throw new Error("Nombre y concentración son obligatorios.");
        await addDoc(collection(db,"medicines"),{name,strength,form:g("form")||"Tableta",unit:g("unit")||"unidades",stock:Math.max(0,Number(form.get("stock"))||0),minimumStock:Math.max(0,Number(form.get("minimumStock"))||0),lot:g("lot"),expiresAt:g("expiresAt"),active:true,createdAt:now});
      } else if(action==="pharmacist"){
        const name=g("name"), email=g("email").toLowerCase(), license=g("license");
        if(!name||!email||!license) throw new Error("Complete todos los datos del farmacéutico.");
        await addDoc(collection(db,"pharmacists"),{name,email,license,active:true,createdAt:now});
      } else if(action==="movement"){
        const medicineId=g("medicineId");
        const quantity=Number(form.get("quantity"));
        const type=form.get("type")==="IN"?"IN":"OUT";
        if(!medicineId||!Number.isInteger(quantity)||quantity<=0) throw new Error("Cantidad inválida.");
        await runTransaction(db,async tx=>{
          const ref=doc(db,"medicines",medicineId);
          const snap=await tx.get(ref);
          if(!snap.exists()) throw new Error("Medicamento no disponible.");
          const data=snap.data();
          const delta=type==="IN"?quantity:-quantity;
          const next=(Number(data.stock)||0)+delta;
          if(next<0) throw new Error("Existencias insuficientes.");
          tx.update(ref,{stock:next});
          tx.set(doc(collection(db,"movements")),{medicineId,medicineName:data.name,type,quantity,prescriptionRef:g("prescriptionRef"),pharmacistEmail:user?.email||"",createdAt:now});
        });
      }
      setNotice("Registro guardado correctamente");setModal(null);
    }catch(err){setNotice(err instanceof Error?err.message:"No se pudo guardar")}
    finally{setBusy(false);setTimeout(()=>setNotice(""),4000)}
  },[user]);

  if(!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if(!user) return <Login/>;

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
      <header><div><p className="eyebrow">{today}</p><h1>{tab==="dashboard"?"Inventario de medicamentos":tab==="movements"?"Historial de movimientos":"Configuración"}</h1><p>{tab==="dashboard"?"Vista actualizada de las existencias disponibles.":tab==="movements"?"Trazabilidad de ingresos y egresos por prescripción.":"Administre el catálogo y el personal autorizado."}</p></div>{tab!=="settings"&&<button className="primary" onClick={()=>setModal("movement")} disabled={!medicines.length}>＋ Registrar movimiento</button>}</header>

      {tab==="dashboard"&&<>
        <div className="stats"><article><span className="stat-icon blue">▤</span><div><small>Existencias totales</small><strong>{total.toLocaleString("es-CR")}</strong><em>unidades disponibles</em></div></article><article><span className="stat-icon amber">!</span><div><small>Stock bajo</small><strong>{low}</strong><em>requieren atención</em></div></article><article><span className="stat-icon green">⇄</span><div><small>Movimientos recientes</small><strong>{movements.length}</strong><em>últimos registros</em></div></article></div>
        <div className="toolbar"><label><span>⌕</span><input aria-label="Buscar medicamentos" placeholder="Buscar por medicamento o concentración..." value={query_} onChange={e=>setQuery(e.target.value)}/></label><span>{filtered.length} medicamentos</span></div>
        {medicines.length?<div className="medicine-grid">{filtered.map(m=>{const pct=Math.min(100,Math.round(m.stock/Math.max(m.minimumStock*2,1)*100));const status=m.stock<=m.minimumStock?"low":"ok";return <article className="medicine-card" key={m.id}><div className="card-head"><span className="pill-icon">✚</span><span className={`badge ${status}`}>{status==="low"?"Stock bajo":"Disponible"}</span></div><h2>{m.name}</h2><p>{m.strength} · {m.form}</p><div className="stock-row"><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span></div><div className="bar"><i className={status} style={{width:`${pct}%`}}/></div><div className="meta"><span>Lote<strong>{m.lot||"—"}</strong></span><span>Vence<strong>{m.expiresAt?new Date(m.expiresAt+"T12:00:00").toLocaleDateString("es-CR",{month:"short",year:"numeric"}):"—"}</strong></span></div><button className="card-action" onClick={()=>setModal("movement")}>Registrar movimiento <span>→</span></button></article>})}</div>:<div className="panel"><div className="empty-block">Aún no hay medicamentos registrados. Agréguelos en Configuración.</div></div>}
      </>}

      {tab==="movements"&&<div className="panel"><div className="panel-title"><div><h2>Actividad reciente</h2><p>Cada operación conserva responsable, fecha y referencia.</p></div></div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Prescripción</th><th>Responsable</th></tr></thead><tbody>{movements.length?movements.map(m=><tr key={m.id}><td>{new Date(m.createdAt).toLocaleString("es-CR")}</td><td><strong>{m.medicineName}</strong></td><td><span className={`type ${m.type}`}>{m.type==="IN"?"Ingreso":"Egreso"}</span></td><td>{m.quantity}</td><td>{m.prescriptionRef||"—"}</td><td>{m.pharmacistEmail}</td></tr>):<tr><td colSpan={6} className="empty">Aún no hay movimientos registrados.</td></tr>}</tbody></table></div></div>}

      {tab==="settings"&&<div className="settings-grid"><div className="panel"><div className="panel-title"><div><h2>Medicamentos</h2><p>Catálogo habilitado para el inventario.</p></div><button className="secondary" onClick={()=>setModal("medicine")}>＋ Agregar</button></div>{medicines.length?medicines.map(m=><div className="list-row" key={m.id}><span className="mini-icon">✚</span><div><strong>{m.name}</strong><small>{m.strength} · {m.form}</small></div><span className="tag">Activo</span></div>):<div className="empty-block">Registre el primer medicamento del catálogo.</div>}</div><div className="panel"><div className="panel-title"><div><h2>Farmacéuticos autorizados</h2><p>Usuarios habilitados para operar.</p></div><button className="secondary" onClick={()=>setModal("pharmacist")}>＋ Agregar</button></div>{pharmacists.length?pharmacists.map(p=><div className="list-row" key={p.id}><span className="mini-icon person">{p.name.slice(0,2).toUpperCase()}</span><div><strong>{p.name}</strong><small>{p.email} · {p.license}</small></div><span className="tag">Activo</span></div>):<div className="empty-block">Registre al primer farmacéutico autorizado.</div>}</div></div>}
    </section>

    {notice&&<div className="toast" role="status">{notice}</div>}
    {modal&&<div className="overlay" onMouseDown={()=>setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)} aria-label="Cerrar">×</button>{modal==="movement"&&<><h2>Registrar movimiento</h2><p>Actualice existencias con trazabilidad completa.</p><form onSubmit={e=>submit(e,"movement")}><label>Medicamento<select name="medicineId" required>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} disp.</option>)}</select></label><div className="form-row"><label>Tipo<select name="type"><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label><label>Cantidad<input name="quantity" type="number" min="1" required/></label></div><label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481"/></label><button className="primary full" disabled={busy}>{busy?"Guardando...":"Confirmar movimiento"}</button></form></>}{modal==="medicine"&&<><h2>Agregar medicamento</h2><p>Defina la presentación y niveles de control.</p><form onSubmit={e=>submit(e,"medicine")}><label>Nombre<input name="name" required placeholder="Ej. Metformina"/></label><div className="form-row"><label>Concentración<input name="strength" required placeholder="500 mg"/></label><label>Forma<input name="form" placeholder="Tableta"/></label></div><div className="form-row"><label>Existencia inicial<input name="stock" type="number" min="0" defaultValue="0"/></label><label>Stock mínimo<input name="minimumStock" type="number" min="0" defaultValue="0"/></label></div><div className="form-row"><label>Lote<input name="lot"/></label><label>Vencimiento<input name="expiresAt" type="date"/></label></div><input type="hidden" name="unit" value="unidades"/><button className="primary full" disabled={busy}>Guardar medicamento</button></form></>}{modal==="pharmacist"&&<><h2>Autorizar farmacéutico</h2><p>El correo será su identificador de acceso.</p><form onSubmit={e=>submit(e,"pharmacist")}><label>Nombre completo<input name="name" required/></label><label>Correo institucional<input name="email" type="email" required/></label><label>Código profesional<input name="license" required placeholder="Ej. CF-1234"/></label><button className="primary full" disabled={busy}>Autorizar usuario</button></form></>}</div></div>}
  </main>;
}
