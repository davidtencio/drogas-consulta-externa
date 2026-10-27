import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [collectionErrors, setCollectionErrors] = useState({ pharmacists: "", movements: "", audit: "" });
  const [collectionReady, setCollectionReady] = useState({ pharmacists: false, movements: false, audit: false });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryInventory = useCallback(() => {
    setInventoryError(null);
    setReady(false);
    setCollectionErrors({ pharmacists: "", movements: "", audit: "" });
    setCollectionReady({ pharmacists: false, movements: false, audit: false });
    setRetryAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (!enabled || DEMO_MODE) return;
    const opts = { includeMetadataChanges: true };
    const unsubMed = onSnapshot(collection(db, "medicines"), opts, (s: QuerySnapshot) => {
      setMedicines(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine))));
      setPending((p) => ({ ...p, medicines: s.metadata.hasPendingWrites }));
      setReady(true);
      setInventoryError(null);
    }, () => {
      setMedicines([]);
      setReady(true);
      setInventoryError("No se pudo obtener el catálogo. Verifique la conexión y sus permisos antes de reintentar.");
    });
    const unsubPh = onSnapshot(collection(db, "pharmacists"), opts, (s: QuerySnapshot) => {
      setPharmacists(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Pharmacist))));
      setPending((p) => ({ ...p, pharmacists: s.metadata.hasPendingWrites }));
      setCollectionReady((r) => ({ ...r, pharmacists: true }));
      setCollectionErrors((e) => ({ ...e, pharmacists: "" }));
    }, () => {
      setPharmacists([]);
      setCollectionReady((r) => ({ ...r, pharmacists: true }));
      setCollectionErrors((e) => ({ ...e, pharmacists: "No se pudo obtener el personal autorizado. Reintente antes de registrar operaciones." }));
    });
    const unsubMov = onSnapshot(
      fbQuery(collection(db, "movements"), orderBy("createdAt", "desc"), limit(MOVEMENTS_LIMIT)),
      opts,
      (s: QuerySnapshot) => {
        setMovements(s.docs.map((d) => ({ id: d.id, ...d.data() } as Movement)));
        setPending((p) => ({ ...p, movements: s.metadata.hasPendingWrites }));
        setCollectionReady((r) => ({ ...r, movements: true }));
        setCollectionErrors((e) => ({ ...e, movements: "" }));
      }, () => {
        setMovements([]);
        setCollectionReady((r) => ({ ...r, movements: true }));
        setCollectionErrors((e) => ({ ...e, movements: "No se pudo obtener el historial reciente. Verifique su conexión y sus permisos." }));
      }
    );
    const unsubAudit = includeAudit ? onSnapshot(
      fbQuery(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(100)),
      (s: QuerySnapshot) => {
        setAuditLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
        setCollectionReady((r) => ({ ...r, audit: true }));
        setCollectionErrors((e) => ({ ...e, audit: "" }));
      }, () => {
        setAuditLogs([]);
        setCollectionReady((r) => ({ ...r, audit: true }));
        setCollectionErrors((e) => ({ ...e, audit: "No se pudo obtener la bitácora administrativa." }));
      }
    ) : () => undefined;
    return () => { unsubMed(); unsubPh(); unsubMov(); unsubAudit(); };
  }, [enabled, includeAudit, retryAttempt]);

  if (DEMO_MODE) return { ...demo, auditLogs: [], pendingWrites: false, loading: false, movementsLoading: false, settingsLoading: false, personnelMessage: null, inventoryError: null, movementsError: null, settingsError: null, retryInventory };
  const pendingWrites = pending.medicines || pending.pharmacists || pending.movements;
  return { medicines, pharmacists, movements, auditLogs, pendingWrites, loading: enabled && !ready,
    movementsLoading: enabled && !collectionReady.movements,
    personnelMessage: collectionErrors.pharmacists || (enabled && !collectionReady.pharmacists ? "Consultando personal autorizado…" : null),
    settingsLoading: enabled && (!ready || !collectionReady.pharmacists || (includeAudit && !collectionReady.audit)),
    inventoryError, movementsError: collectionErrors.movements || null,
    settingsError: inventoryError || collectionErrors.pharmacists || (includeAudit ? collectionErrors.audit : null) || null,
    retryInventory };
}
