export type AppRole = "admin" | "operator" | "unauthorized";
export type AuditLog = { id: string; action: string; entityType: string; entityId: string; actorEmail: string; createdAt: string; details?: Record<string, unknown> };

const ADMIN_EMAILS = new Set(["davidtencio@gmail.com"]);
const OPERATOR_EMAILS = new Set(["fhsvp2208@gmail.com"]);

/** Espejo de presentación de las reglas Firestore; las reglas siguen siendo la autoridad. */
export function roleForEmail(email: string | null | undefined): AppRole {
  const normalized = (email ?? "").trim().toLowerCase();
  if (ADMIN_EMAILS.has(normalized)) return "admin";
  if (OPERATOR_EMAILS.has(normalized)) return "operator";
  return "unauthorized";
}

export function canManageCatalog(role: AppRole) { return role === "admin"; }
export function canOperateInventory(role: AppRole) { return role === "admin" || role === "operator"; }
