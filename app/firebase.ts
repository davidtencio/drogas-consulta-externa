import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

// Public web config (safe to ship in the client bundle). Real protection comes
// from Firebase Auth + Firestore security rules, not from hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyC6CCBbfy3qhsMyaf3OldUJYXFGutkV740",
  authDomain: "drogas-consulta-externa.firebaseapp.com",
  projectId: "drogas-consulta-externa",
  storageBucket: "drogas-consulta-externa.firebasestorage.app",
  messagingSenderId: "903564757399",
  appId: "1:903564757399:web:fcfb002a2a46049961dcd2",
  measurementId: "G-8CEPWRL02K",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistencia offline (IndexedDB) para que la app funcione con red inestable:
// las lecturas se sirven de caché y las escrituras se encolan y sincronizan al
// reconectar. Solo en el navegador; en el servidor (SSR) se usa caché en memoria.
function createDb(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Ya inicializado (p. ej. hot reload) o sin IndexedDB disponible.
    return getFirestore(app);
  }
}

export const db = createDb();
