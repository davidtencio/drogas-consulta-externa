// Backend de mutaciones administrativas. Verifica el ID token de Firebase y el
// rol de administrador del lado servidor, y persiste el cambio junto con su
// registro de auditoría en un único lote atómico con el Admin SDK. Endurece el
// modelo: el cliente ya no escribe directamente el catálogo ni la bitácora
// (las reglas de Firestore lo niegan), de modo que la auditoría no puede
// omitirse ni falsificarse.

import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp, adminDb } from "../../../server/adminApp";
import { planAdminMutation, type AdminOp } from "../../../lib/adminMutations";
import { canManageCatalog, roleForEmail } from "../../../lib/authz";
import type { InventoryLot } from "../../../lib/inventory";

// El Admin SDK requiere el runtime de Node (no Edge) y ejecución dinámica.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

type AdminAuthWithClaims = {
  getUserByEmail?: (email: string) => Promise<{ uid: string; customClaims?: Record<string, unknown> }>;
  setCustomUserClaims?: (uid: string, claims: Record<string, unknown>) => Promise<void>;
};

async function syncOperatorClaim(targetEmail: string | undefined, active: boolean): Promise<void> {
  const normalized = (targetEmail ?? "").trim().toLowerCase();
  if (!normalized) return;
  try {
    const authClient = getAuth(adminApp()) as unknown as AdminAuthWithClaims;
    if (typeof authClient.getUserByEmail !== "function" || typeof authClient.setCustomUserClaims !== "function") return;
    const userRecord = await authClient.getUserByEmail(normalized);
    await authClient.setCustomUserClaims(userRecord.uid, { ...(userRecord.customClaims ?? {}), operator: active });
  } catch {
    // Si el usuario aún no ha iniciado sesión con Google, el documento en
    // authorizedOperators/{email} ya le otorga acceso por reglas de Firestore.
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  let email: string | undefined;
  let emailVerified = false;
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    email = decoded.email;
    emailVerified = decoded.email_verified === true;
  } catch {
    return NextResponse.json({ error: "Sesión inválida o expirada." }, { status: 401 });
  }

  if (!emailVerified) return NextResponse.json({ error: "Correo no verificado." }, { status: 403 });
  if (!canManageCatalog(roleForEmail(email))) {
    return NextResponse.json({ error: "No autorizado para administrar el catálogo." }, { status: 403 });
  }

  let op: AdminOp;
  try {
    op = (await req.json()) as AdminOp;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const db = adminDb();
  const entityCollection = typeof op?.op === "string" && op.op.startsWith("pharmacist") ? "pharmacists" : "medicines";

  let existingLots: InventoryLot[] | undefined;
  let existingPharmacistEmail: string | undefined;
  if (op?.op === "medicine.update" && typeof op.id === "string" && op.id.trim()) {
    try {
      const docRef = db.collection("medicines").doc(op.id.trim()) as {
        get?: () => Promise<{ data?: () => Record<string, unknown> | undefined }>;
      };
      if (typeof docRef.get === "function") {
        const snap = await docRef.get();
        const rawLots = snap.data?.()?.lots;
        if (Array.isArray(rawLots)) existingLots = rawLots as InventoryLot[];
      }
    } catch {
      return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
    }
  } else if (
    (op?.op === "pharmacist.update" || (op?.op === "setActive" && op.col === "pharmacists")) &&
    typeof op.id === "string" &&
    op.id.trim()
  ) {
    try {
      const docRef = db.collection("pharmacists").doc(op.id.trim()) as {
        get?: () => Promise<{ data?: () => Record<string, unknown> | undefined }>;
      };
      if (typeof docRef.get === "function") {
        const snap = await docRef.get();
        const rawEmail = snap.data?.()?.email;
        if (typeof rawEmail === "string") existingPharmacistEmail = rawEmail;
      }
    } catch {
      return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
    }
  }

  const ctx = {
    actorEmail: (email ?? "").trim().toLowerCase(),
    now: new Date().toISOString(),
    newId: db.collection(entityCollection).doc().id,
    existingLots,
    existingPharmacistEmail,
  };

  let writes;
  try {
    writes = planAdminMutation(op, ctx);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Datos inválidos." }, { status: 400 });
  }

  try {
    const batch = db.batch();
    for (const w of writes) {
      const ref = w.kind === "add" ? db.collection(w.collection).doc() : db.collection(w.collection).doc(w.id);
      if (w.kind === "update") batch.update(ref, w.data);
      else batch.set(ref, w.data);
    }
    await batch.commit();
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }

  if (op.op === "pharmacist.create") {
    await syncOperatorClaim(op.fields.email, true);
  } else if (op.op === "pharmacist.update") {
    if (existingPharmacistEmail && existingPharmacistEmail.trim().toLowerCase() !== op.fields.email.trim().toLowerCase()) {
      await syncOperatorClaim(existingPharmacistEmail, false);
    }
    await syncOperatorClaim(op.fields.email, true);
  } else if (op.op === "setActive" && op.col === "pharmacists") {
    await syncOperatorClaim(existingPharmacistEmail, op.active);
  }

  return NextResponse.json({ ok: true });
}
