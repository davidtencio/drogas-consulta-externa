import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { collection, onSnapshot, query as fbQuery, where, type QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { Movement } from "../lib/inventory";
import { DEMO_MODE, getDemoSnapshot, subscribeDemo } from "../lib/demo";

/**
 * Movimientos que alimentan la Analítica: los egresos anulados (`voidedAt`) y los
 * movimientos editados (`updatedAt`, de donde salen las correcciones de ingresos).
 * Son dos consultas acotadas por un solo campo, así que usan los índices simples
 * automáticos de Firestore y no leen la colección completa. Solo se suscribe
 * mientras `enabled` (la pestaña está abierta).
 */
export function useAnalyticsData(enabled: boolean) {
  const demo = useSyncExternalStore(subscribeDemo, getDemoSnapshot, getDemoSnapshot);
  const [voided, setVoided] = useState<Movement[]>([]);
  const [edited, setEdited] = useState<Movement[]>([]);
  const [ready, setReady] = useState({ voided: false, edited: false });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setReady({ voided: false, edited: false });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || DEMO_MODE) return;
    const fail = () => setError("No se pudo obtener la información de anulaciones. Verifique su conexión y sus permisos.");
    const toMovements = (s: QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() } as Movement));
    const unsubVoided = onSnapshot(fbQuery(collection(db, "movements"), where("voidedAt", ">", "")), (s: QuerySnapshot) => {
      setVoided(toMovements(s));
      setReady((r) => ({ ...r, voided: true }));
    }, () => { setVoided([]); setReady((r) => ({ ...r, voided: true })); fail(); });
    const unsubEdited = onSnapshot(fbQuery(collection(db, "movements"), where("updatedAt", ">", "")), (s: QuerySnapshot) => {
      setEdited(toMovements(s));
      setReady((r) => ({ ...r, edited: true }));
    }, () => { setEdited([]); setReady((r) => ({ ...r, edited: true })); fail(); });
    return () => { unsubVoided(); unsubEdited(); };
  }, [enabled, attempt]);

  // Un egreso anulado que además se editó antes aparece en ambas consultas: se une por id.
  const movements = useMemo(() => {
    const byId = new Map<string, Movement>();
    for (const m of [...edited, ...voided]) byId.set(m.id, m);
    return [...byId.values()];
  }, [edited, voided]);

  if (DEMO_MODE) return { movements: demo.movements, loading: false, error: null, retry };
  return { movements, loading: enabled && !(ready.voided && ready.edited), error, retry };
}
