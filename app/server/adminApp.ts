// Inicialización del Admin SDK de Firebase, SOLO para código de servidor (route
// handlers). Usa Application Default Credentials: en Firebase App Hosting / Cloud
// Run las credenciales de la cuenta de servicio del runtime están disponibles
// automáticamente, sin archivos de clave. El Admin SDK omite las reglas de
// Firestore, por eso este módulo nunca debe importarse desde el cliente.

import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const PROJECT_ID = "drogas-consulta-externa";

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

/** App admin única (reutilizada entre invocaciones del mismo proceso). */
export function adminApp(): App {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApps()[0] : initializeApp({ projectId: PROJECT_ID });
  return cachedApp;
}

/** Firestore con privilegios de administrador (omite las reglas de seguridad). */
export function adminDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(adminApp());
  return cachedDb;
}
