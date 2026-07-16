import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query as fbQuery } from "firebase/firestore";
import { db } from "../firebase";
import { sortByName, type Medicine, type Pharmacist, type Movement } from "../lib/inventory";

/** Últimos movimientos que se mantienen en memoria para la vista. */
const MOVEMENTS_LIMIT = 200;

/**
 * Suscribe (mientras `enabled`) a los medicamentos, farmacéuticos y últimos
 * movimientos en Firestore, y los devuelve ya ordenados. Limpia las
 * suscripciones al desmontar o al deshabilitarse.
 */
export function useInventoryData(enabled: boolean) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const unsubMed = onSnapshot(collection(db, "medicines"), (s) =>
      setMedicines(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Medicine))))
    );
    const unsubPh = onSnapshot(collection(db, "pharmacists"), (s) =>
      setPharmacists(sortByName(s.docs.map((d) => ({ id: d.id, ...d.data() } as Pharmacist))))
    );
    const unsubMov = onSnapshot(
      fbQuery(collection(db, "movements"), orderBy("createdAt", "desc"), limit(MOVEMENTS_LIMIT)),
      (s) => setMovements(s.docs.map((d) => ({ id: d.id, ...d.data() } as Movement)))
    );
    return () => { unsubMed(); unsubPh(); unsubMov(); };
  }, [enabled]);

  return { medicines, pharmacists, movements };
}
