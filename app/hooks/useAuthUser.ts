import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import * as firestore from "firebase/firestore";
import { auth, db } from "../firebase";
import { roleForEmail } from "../lib/authz";
import { DEMO_EMAIL, DEMO_MODE } from "../lib/demo";

type AuthUser = Pick<User, "email"> & {
  getIdTokenResult?: () => Promise<{ claims?: Record<string, unknown> }>;
};

/** Usuario autenticado, estado de carga (`authReady`) y si tiene acceso dinámico de operador (`dynamicOperator`). */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(DEMO_MODE ? { email: DEMO_EMAIL } : null);
  const [authReady, setAuthReady] = useState(DEMO_MODE);
  const [dynamicOperator, setDynamicOperator] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setDynamicOperator(false);
      if (!u?.email || roleForEmail(u.email) !== "unauthorized") {
        setAuthReady(true);
        return;
      }
      const normalized = u.email.trim().toLowerCase();
      void (async () => {
        let allowed = false;
        try {
          if (typeof u.getIdTokenResult === "function") {
            const tokenRes = await u.getIdTokenResult();
            if (tokenRes?.claims?.operator === true) allowed = true;
          }
          const fsAny = firestore as { doc?: typeof firestore.doc; getDoc?: typeof firestore.getDoc };
          if (!allowed && typeof fsAny.doc === "function" && typeof fsAny.getDoc === "function") {
            const snap = await fsAny.getDoc(fsAny.doc(db, "authorizedOperators", normalized));
            if (snap?.exists?.() && (snap.data() as { active?: boolean } | undefined)?.active === true) {
              allowed = true;
            }
          }
        } catch {
          allowed = false;
        }
        if (!cancelled) {
          setDynamicOperator(allowed);
          setAuthReady(true);
        }
      })();
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { user, authReady, dynamicOperator };
}
