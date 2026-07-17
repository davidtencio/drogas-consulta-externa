import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { DEMO_EMAIL, DEMO_MODE } from "../lib/demo";

type AuthUser = Pick<User, "email">;

/** Usuario autenticado y si el estado de auth ya se resolvió (authReady). */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(DEMO_MODE ? { email: DEMO_EMAIL } : null);
  const [authReady, setAuthReady] = useState(DEMO_MODE);
  useEffect(() => {
    if (DEMO_MODE) return;
    return onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
  }, []);
  return { user, authReady };
}
