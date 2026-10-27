"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

/** Pantalla de acceso con Google. Protege toda la app. */
export function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function google() {
    setBusy(true); setError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("No se pudo iniciar sesión. Intente de nuevo.");
      }
    }
    finally { setBusy(false); }
  }
  return <main className="auth-screen"><div className="auth-layout">
    <section className="auth-intro" aria-label="Control de Drogas · Consulta externa">
      <span className="brand-mark" aria-hidden="true">Rx</span>
      <span className="eyebrow">FARMACIA · CONSULTA EXTERNA</span>
      <h1>Control de Drogas</h1>
      <p>Existencias y trazabilidad en un mismo lugar.</p>
      <ul className="auth-features">
        <li><Icon name="pill" size={20} /><span>Inventario de medicamentos y lotes</span></li>
        <li><Icon name="movements" size={20} /><span>Historial de ingresos, egresos y responsables</span></li>
        <li><Icon name="check" size={20} /><span>Evidencia de tomas de inventario</span></li>
      </ul>
    </section>
    <section className="auth-card" aria-labelledby="login-title" aria-busy={busy}>
    <div className="auth-card-heading"><span className="eyebrow">ACCESO AUTORIZADO</span><ThemeToggle /></div>
    <h2 id="login-title">Iniciar sesión</h2>
    <p>Use la cuenta de Google habilitada para su trabajo en farmacia.</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button className="google-btn" onClick={google} disabled={busy}>
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/><path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-2.9.7-4.3l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.4l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.7-3.7-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
      {busy ? "Conectando..." : "Continuar con Google"}
    </button>
    <small className="auth-note">El acceso depende del rol asignado a su cuenta. Si necesita autorización, contacte a la persona administradora.</small>
    </section>
  </div></main>;
}
