import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query as fbQuery, type QuerySnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { sortByName, type Medicine, type Pharmacist, type Movement } from "../lib/inventory";

/** Últimos movimientos que se mantienen en memoria para la vista. */
const MOVEMENTS_LIMIT = 200;

/**
 * Suscribe (mientras `enabled`) a los medicamentos, farmacéuticos y últimos
 * movimientos en Firestore, y los devuelve ya ordenados. Limpia las
 * suscripciones al desmontar o al deshabilitarse. También reporta
 * `pendingWrites`: si hay escrituras locales aún sin sincronizar con el servidor.
 */
export function useInventoryData(enabled: boolean) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  // Escrituras pendientes por colección; el indicador combina las tres.
  const [pending, setPending] = useState({ medicines: false, pharmacists: false, movements: false });

  useEffect(() => {
    if (!enabled) return;
    const opts = { includeMetadataChanges: true };
    const unsubMed = onSnapshot(collection(db, "medicines"), opts, (s: QuerySnapshot) => {
      setMedicines(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine))));
      setPending((p) => ({ ...p, medicines: s.metadata.hasPendingWrites }));
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
    return () => { unsubMed(); unsubPh(); unsubMov(); };
  }, [enabled]);

  const pendingWrites = pending.medicines || pending.pharmacists || pending.movements;
  return { medicines, pharmacists, movements, pendingWrites };
}
