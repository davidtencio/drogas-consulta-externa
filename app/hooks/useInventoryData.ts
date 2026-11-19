import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { collection, limit, onSnapshot, orderBy, query as fbQuery, where, type QueryConstraint, type QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { sortByName, type Medicine, type Pharmacist, type Movement } from "../lib/inventory";
import { DEMO_MODE, getDemoSnapshot, subscribeDemo } from "../lib/demo";
import type { AuditLog } from "../lib/authz";

/** Paso y límite inicial de movimientos recientes que se mantienen en memoria para la vista. */
export const MOVEMENTS_LIMIT = 50;

/** Rango de fechas `YYYY-MM-DD` (UTC, inclusivo) para acotar la consulta de movimientos. */
export type MovementsRange = { from?: string; to?: string };

/**
 * Restricciones de Firestore para traer los movimientos de un rango de fechas,
 * del más reciente al más antiguo. El rango y el orden usan el mismo campo
 * (`createdAt`, ISO), así que basta el índice simple automático.
 */
export function movementsRangeConstraints(range: MovementsRange = {}): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (range.from) constraints.push(where("createdAt", ">=", range.from));
  if (range.to) constraints.push(where("createdAt", "<=", `${range.to}\uf8ff`));
  constraints.push(orderBy("createdAt", "desc"));
  return constraints;
}

/**
 * Suscribe (mientras `enabled`) a los medicamentos y farmacéuticos en Firestore,
 * y bajo demanda a los últimos movimientos (`includeMovements`) y a la bitácora
 * administrativa (`includeAudit`). `movementsRange` acota los movimientos a un
 * rango de fechas en el servidor; sin él se traen los más recientes. Limpia las suscripciones al desmontar o al
 * cambiar de pestaña para ahorrar lecturas de cuota en Firestore.
 */
export function useInventoryData(enabled: boolean, includeAudit = false, includeMovements = true, movementsRange: MovementsRange = {}) {
  const rangeFrom = movementsRange.from ?? "";
  const rangeTo = movementsRange.to ?? "";
  const demo = useSyncExternalStore(subscribeDemo, getDemoSnapshot, getDemoSnapshot);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLimit, setMovementsLimit] = useState(MOVEMENTS_LIMIT);
  // Al cambiar el rango de fechas, la consulta vuelve al primer bloque.
  const rangeKey = `${rangeFrom}|${rangeTo}`;
  const [prevRangeKey, setPrevRangeKey] = useState(rangeKey);
  if (rangeKey !== prevRangeKey) { setPrevRangeKey(rangeKey); setMovementsLimit(MOVEMENTS_LIMIT); }
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  // Escrituras pendientes por colección; el indicador combina medicamentos y movimientos.
  const [pending, setPending] = useState({ medicines: false, movements: false });
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

  const loadMoreMovements = useCallback(() => {
    setMovementsLimit((current) => current + MOVEMENTS_LIMIT);
  }, []);

  useEffect(() => {
    if (!enabled || DEMO_MODE) return;
    const unsubMed = onSnapshot(collection(db, "medicines"), { includeMetadataChanges: true }, (s: QuerySnapshot) => {
      setMedicines(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine))));
      setPending((p) => ({ ...p, medicines: s.metadata.hasPendingWrites }));
      setReady(true);
      setInventoryError(null);
    }, () => {
      setMedicines([]);
      setReady(true);
      setInventoryError("No se pudo obtener el catálogo. Verifique la conexión y sus permisos antes de reintentar.");
    });
    const unsubPh = onSnapshot(collection(db, "pharmacists"), { includeMetadataChanges: false }, (s: QuerySnapshot) => {
      setPharmacists(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Pharmacist))));
      setCollectionReady((r) => ({ ...r, pharmacists: true }));
      setCollectionErrors((e) => ({ ...e, pharmacists: "" }));
    }, () => {
      setPharmacists([]);
      setCollectionReady((r) => ({ ...r, pharmacists: true }));
      setCollectionErrors((e) => ({ ...e, pharmacists: "No se pudo obtener el personal autorizado. Reintente antes de registrar operaciones." }));
    });
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

    return () => { unsubMed(); unsubPh(); unsubAudit(); };
  }, [enabled, includeAudit, retryAttempt]);

  useEffect(() => {
    if (!enabled || !includeMovements || DEMO_MODE) return;
    const unsubMov = onSnapshot(
      fbQuery(collection(db, "movements"), ...movementsRangeConstraints({ from: rangeFrom, to: rangeTo }), limit(movementsLimit)),
      { includeMetadataChanges: true },
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
    return () => unsubMov();
  }, [enabled, includeMovements, movementsLimit, rangeFrom, rangeTo, retryAttempt]);

  if (DEMO_MODE) return { ...demo, countMovements: demo.movements, hasMoreMovements: false, loadMoreMovements, auditLogs: [], pendingWrites: false, loading: false, movementsLoading: false, settingsLoading: false, personnelMessage: null, inventoryError: null, movementsError: null, settingsError: null, retryInventory };
  const pendingWrites = pending.medicines || pending.movements;
  const hasMoreMovements = movements.length >= movementsLimit;
  return { medicines, pharmacists, movements, countMovements: movements, hasMoreMovements, loadMoreMovements, auditLogs, pendingWrites, loading: enabled && !ready,
    movementsLoading: enabled && includeMovements && !collectionReady.movements,
    personnelMessage: collectionErrors.pharmacists || (enabled && !collectionReady.pharmacists ? "Consultando personal autorizado…" : null),
    settingsLoading: enabled && (!ready || !collectionReady.pharmacists || (includeAudit && !collectionReady.audit)),
    inventoryError, movementsError: collectionErrors.movements || null,
    settingsError: inventoryError || collectionErrors.pharmacists || (includeAudit ? collectionErrors.audit : null) || null,
    retryInventory };
}
