"use client";

import { useAuthUser } from "../hooks/useAuthUser";
import { Login } from "../components/Login";
import { ArqueoScreen } from "../components/ArqueoScreen";

/** Ruta independiente /arqueo, pensada para usar desde el móvil. */
export default function ArqueoPage() {
  const { user, authReady } = useAuthUser();
  if (!authReady) return <div className="auth-screen"><div className="auth-loading">Cargando…</div></div>;
  if (!user) return <Login />;
  return <ArqueoScreen email={user.email || ""} />;
}
