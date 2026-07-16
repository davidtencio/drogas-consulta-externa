"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Medicine = { id:number; name:string; strength:string; form:string; unit:string; stock:number; minimumStock:number; lot:string; expiresAt:string };
type Pharmacist = { id:number; name:string; email:string; license:string; active:number };
type Movement = { id:number; type:"IN"|"OUT"; quantity:number; medicineName:string; prescriptionRef:string; pharmacistEmail:string; createdAt:string };

const demoMedicines: Medicine[] = [
  { id:1,name:"Acetaminofén",strength:"500 mg",form:"Tableta",unit:"tabletas",stock:842,minimumStock:250,lot:"AC-2604",expiresAt:"2027-04-30" },
  { id:2,name:"Amoxicilina",strength:"500 mg",form:"Cápsula",unit:"cápsulas",stock:96,minimumStock:120,lot:"AM-1182",expiresAt:"2026-11-30" },
  { id:3,name:"Losartán",strength:"50 mg",form:"Tableta",unit:"tabletas",stock:412,minimumStock:150,lot:"LO-5091",expiresAt:"2027-08-31" },
  { id:4,name:"Insulina NPH",strength:"100 UI/mL",form:"Frasco",unit:"frascos",stock:38,minimumStock:20,lot:"IN-7710",expiresAt:"2026-09-15" },
];

export default function Home() {
  const [tab,setTab]=useState<"dashboard"|"movements"|"settings">("dashboard");
  const [medicines,setMedicines]=useState<Medicine[]>(demoMedicines);
  const [pharmacists,setPharmacists]=useState<Pharmacist[]>([]);
  const [movements,setMovements]=useState<Movement[]>([]);
  const [query,setQuery]=useState("");
  const [modal,setModal]=useState<"movement"|"medicine"|"pharmacist"|null>(null);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{try{const r=await fetch("/api/inventory");if(r.ok){const d=await r.json();setMedicines(d.medicines);setPharmacists(d.pharmacists);setMovements(d.movements)}}catch{}},[]);
  useEffect(()=>{void load()},[load]);
  const filtered=useMemo(()=>medicines.filter(m=>`${m.name} ${m.strength}`.toLowerCase().includes(query.toLowerCase())),[medicines,query]);
  const total=medicines.reduce((a,m)=>a+m.stock,0), low=medicines.filter(m=>m.stock<=m.minimumStock).length;

  async function submit(e:FormEvent<HTMLFormElement>, action:string){e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);const payload=Object.fromEntries(form.entries());try{const r=await fetch("/api/inventory",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...payload})});const d=await r.json();if(!r.ok)throw new Error(d.error);setNotice("Registro guardado correctamente");setModal(null);await load()}catch(err){setNotice(err instanceof Error?err.message:"No se pudo guardar")}finally{setBusy(false);setTimeout(()=>setNotice(""),4000)}}

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">Rx</span><div><strong>FarmaControl</strong><small>Consulta externa</small></div></div>
      <nav aria-label="Navegación principal">
        <button className={tab==="dashboard"?"active":""} onClick={()=>setTab("dashboard")}><span>▦</span> Inventario</button>
        <button className={tab==="movements"?"active":""} onClick={()=>setTab("movements")}><span>⇄</span> Movimientos</button>
        <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><span>⚙</span> Configuración</button>
      </nav>
      <div className="secure"><span>✓</span><div><strong>Conexión protegida</strong><small>Datos cifrados en tránsito y reposo</small></div></div>
      <div className="profile"><div className="avatar">DF</div><div><strong>Farmacia</strong><small>Sesión autorizada</small></div></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">MIÉRCOLES, 15 DE JULIO</p><h1>{tab==="dashboard"?"Inventario de medicamentos":tab==="movements"?"Historial de movimientos":"Configuración"}</h1><p>{tab==="dashboard"?"Vista actualizada de las existencias disponibles.":tab==="movements"?"Trazabilidad de ingresos y egresos por prescripción.":"Administre el catálogo y el personal autorizado."}</p></div>{tab!=="settings"&&<button className="primary" onClick={()=>setModal("movement")}>＋ Registrar movimiento</button>}</header>

      {tab==="dashboard"&&<>
        <div className="stats"><article><span className="stat-icon blue">▤</span><div><small>Existencias totales</small><strong>{total.toLocaleString("es-CR")}</strong><em>unidades disponibles</em></div></article><article><span className="stat-icon amber">!</span><div><small>Stock bajo</small><strong>{low}</strong><em>requieren atención</em></div></article><article><span className="stat-icon green">⇄</span><div><small>Movimientos recientes</small><strong>{movements.length}</strong><em>últimos registros</em></div></article></div>
        <div className="toolbar"><label><span>⌕</span><input aria-label="Buscar medicamentos" placeholder="Buscar por medicamento o concentración..." value={query} onChange={e=>setQuery(e.target.value)}/></label><span>{filtered.length} medicamentos</span></div>
        <div className="medicine-grid">{filtered.map(m=>{const pct=Math.min(100,Math.round(m.stock/Math.max(m.minimumStock*2,1)*100));const status=m.stock<=m.minimumStock?"low":"ok";return <article className="medicine-card" key={m.id}><div className="card-head"><span className="pill-icon">✚</span><span className={`badge ${status}`}>{status==="low"?"Stock bajo":"Disponible"}</span></div><h2>{m.name}</h2><p>{m.strength} · {m.form}</p><div className="stock-row"><strong>{m.stock.toLocaleString("es-CR")}</strong><span>{m.unit}</span></div><div className="bar"><i className={status} style={{width:`${pct}%`}}/></div><div className="meta"><span>Lote<strong>{m.lot||"—"}</strong></span><span>Vence<strong>{m.expiresAt?new Date(m.expiresAt+"T12:00:00").toLocaleDateString("es-CR",{month:"short",year:"numeric"}):"—"}</strong></span></div><button className="card-action" onClick={()=>setModal("movement")}>Registrar movimiento <span>→</span></button></article>})}</div>
      </>}

      {tab==="movements"&&<div className="panel"><div className="panel-title"><div><h2>Actividad reciente</h2><p>Cada operación conserva responsable, fecha y referencia.</p></div></div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Prescripción</th><th>Responsable</th></tr></thead><tbody>{movements.length?movements.map(m=><tr key={m.id}><td>{new Date(m.createdAt).toLocaleString("es-CR")}</td><td><strong>{m.medicineName}</strong></td><td><span className={`type ${m.type}`}>{m.type==="IN"?"Ingreso":"Egreso"}</span></td><td>{m.quantity}</td><td>{m.prescriptionRef||"—"}</td><td>{m.pharmacistEmail}</td></tr>):<tr><td colSpan={6} className="empty">Aún no hay movimientos registrados.</td></tr>}</tbody></table></div></div>}

      {tab==="settings"&&<div className="settings-grid"><div className="panel"><div className="panel-title"><div><h2>Medicamentos</h2><p>Catálogo habilitado para el inventario.</p></div><button className="secondary" onClick={()=>setModal("medicine")}>＋ Agregar</button></div>{medicines.map(m=><div className="list-row" key={m.id}><span className="mini-icon">✚</span><div><strong>{m.name}</strong><small>{m.strength} · {m.form}</small></div><span className="tag">Activo</span></div>)}</div><div className="panel"><div className="panel-title"><div><h2>Farmacéuticos autorizados</h2><p>Usuarios habilitados para operar.</p></div><button className="secondary" onClick={()=>setModal("pharmacist")}>＋ Agregar</button></div>{pharmacists.length?pharmacists.map(p=><div className="list-row" key={p.id}><span className="mini-icon person">{p.name.slice(0,2).toUpperCase()}</span><div><strong>{p.name}</strong><small>{p.email} · {p.license}</small></div><span className="tag">Activo</span></div>):<div className="empty-block">Registre al primer farmacéutico autorizado.</div>}</div></div>}
    </section>

    {notice&&<div className="toast" role="status">{notice}</div>}
    {modal&&<div className="overlay" onMouseDown={()=>setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setModal(null)} aria-label="Cerrar">×</button>{modal==="movement"&&<><h2>Registrar movimiento</h2><p>Actualice existencias con trazabilidad completa.</p><form onSubmit={e=>submit(e,"movement")}><label>Medicamento<select name="medicineId" required>{medicines.map(m=><option key={m.id} value={m.id}>{m.name} {m.strength} — {m.stock} disp.</option>)}</select></label><div className="form-row"><label>Tipo<select name="type"><option value="OUT">Egreso</option><option value="IN">Ingreso</option></select></label><label>Cantidad<input name="quantity" type="number" min="1" required/></label></div><label>Referencia de prescripción<input name="prescriptionRef" placeholder="Ej. RX-2026-00481"/></label><button className="primary full" disabled={busy}>{busy?"Guardando...":"Confirmar movimiento"}</button></form></>}{modal==="medicine"&&<><h2>Agregar medicamento</h2><p>Defina la presentación y niveles de control.</p><form onSubmit={e=>submit(e,"medicine")}><label>Nombre<input name="name" required placeholder="Ej. Metformina"/></label><div className="form-row"><label>Concentración<input name="strength" required placeholder="500 mg"/></label><label>Forma<input name="form" placeholder="Tableta"/></label></div><div className="form-row"><label>Existencia inicial<input name="stock" type="number" min="0" defaultValue="0"/></label><label>Stock mínimo<input name="minimumStock" type="number" min="0" defaultValue="0"/></label></div><div className="form-row"><label>Lote<input name="lot"/></label><label>Vencimiento<input name="expiresAt" type="date"/></label></div><input type="hidden" name="unit" value="unidades"/><button className="primary full" disabled={busy}>Guardar medicamento</button></form></>}{modal==="pharmacist"&&<><h2>Autorizar farmacéutico</h2><p>El correo será su identificador de acceso.</p><form onSubmit={e=>submit(e,"pharmacist")}><label>Nombre completo<input name="name" required/></label><label>Correo institucional<input name="email" type="email" required/></label><label>Código profesional<input name="license" required placeholder="Ej. CF-1234"/></label><button className="primary full" disabled={busy}>Autorizar usuario</button></form></>}</div></div>}
  </main>
}
