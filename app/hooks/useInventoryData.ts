import { useEffect, useState, useSyncExternalStore } from "react";
import { collection, limit, onSnapshot, orderBy, query as fbQuery, type QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { sortByName, type Medicine, type Pharmacist, type Movement } from "../lib/inventory";
import { DEMO_MODE, getDemoSnapshot, subscribeDemo } from "../lib/demo";
import type { AuditLog } from "../lib/authz";

/** Últimos movimientos que se mantienen en memoria para la vista. */
const MOVEMENTS_LIMIT = 200;

/**
 * Suscribe (mientras `enabled`) a los medicamentos, farmacéuticos y últimos
 * movimientos en Firestore, y los devuelve ya ordenados. Limpia las
 * suscripciones al desmontar o al deshabilitarse. También reporta
 * `pendingWrites`: si hay escrituras locales aún sin sincronizar con el servidor.
 */
export function useInventoryData(enabled: boolean, includeAudit = false) {
  const demo = useSyncExternalStore(subscribeDemo, getDemoSnapshot, getDemoSnapshot);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  // Escrituras pendientes por colección; el indicador combina las tres.
  const [pending, setPending] = useState({ medicines: false, pharmacists: false, movements: false });
  // `ready` pasa a true con el primer snapshot de medicamentos; permite mostrar
  // esqueletos de carga en lugar de un dashboard vacío mientras llegan los datos.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || DEMO_MODE) return;
    const opts = { includeMetadataChanges: true };
    const unsubMed = onSnapshot(collection(db, "medicines"), opts, (s: QuerySnapshot) => {
      setMedicines(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine))));
      setPending((p) => ({ ...p, medicines: s.metadata.hasPendingWrites }));
      setReady(true);
    });
    const unsubPh = onSnapshot(collection(db, "pharmacists"), opts, (s: QuerySnapshot) => {
      setPharmacists(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Pharmacist))));
      setPending((p) => ({ ...p, pharmacists: s.metadata.hasPendingWrites }));
    });
    const unsubMov = onSnapshot(
      fbQuery(collection(db, "movements"), orderBy("createdAt", "desc"), limit(MOVEMENTS_LIMIT)),
      opts,
      (s: QuerySnapshot) => {
        setMovements(s.docs.map((d) => ({ id: d.id, ...d.data() } as Movement)));
        setPending((p) => ({ ...p, movements: s.metadata.hasPendingWrites }));
      }
    );
    const unsubAudit = includeAudit ? onSnapshot(
      fbQuery(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(100)),
      (s: QuerySnapshot) => setAuditLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)))
    ) : () => undefined;
    return () => { unsubMed(); unsubPh(); unsubMov(); unsubAudit(); };
  }, [enabled, includeAudit]);

  if (DEMO_MODE) return { ...demo, auditLogs: [], pendingWrites: false, loading: false };
  const pendingWrites = pending.medicines || pending.pharmacists || pending.movements;
  return { medicines, pharmacists, movements, auditLogs, pendingWrites, loading: enabled && !ready };
}
