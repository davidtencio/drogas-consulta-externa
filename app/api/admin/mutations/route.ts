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

// El Admin SDK requiere el runtime de Node (no Edge) y ejecución dinámica.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
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
  const ctx = {
    actorEmail: (email ?? "").trim().toLowerCase(),
    now: new Date().toISOString(),
    newId: db.collection(entityCollection).doc().id,
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

  return NextResponse.json({ ok: true });
}
