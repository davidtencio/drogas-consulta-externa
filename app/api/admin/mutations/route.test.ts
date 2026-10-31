import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const docGet = vi.fn<() => Promise<{ data: () => Record<string, unknown> | undefined }>>(async () => ({ data: () => undefined }));
const colGet = vi.fn<() => Promise<{ docs: { id: string; ref: { id: string }; data: () => Record<string, unknown> }[] }>>(async () => ({ docs: [] }));
const fakeDb = {
  collection: (name: string) => ({
    doc: (id?: string) => ({ id: id ?? `auto-${name}`, get: docGet }),
    get: colGet,
  }),
  batch: () => ({ set: batchSet, update: batchUpdate, delete: batchDelete, commit: batchCommit }),
};

vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken }) }));
vi.mock("../../../server/adminApp", () => ({ adminApp: () => ({}), adminDb: () => fakeDb }));

import { POST } from "./route";

type Body = Record<string, unknown> | undefined;
function request(authHeader: string | null, body: Body) {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? authHeader : null) },
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  } as unknown as Parameters<typeof POST>[0];
}

const medOp = { op: "medicine.create", fields: { name: "Metformina", strength: "500 mg", form: "Tableta", minimumStock: 20, lot: "L1", expiresAt: "2027-01-01", code: "101-20-5001" }, initialStock: 0, pharmacistEmail: "" };

beforeEach(() => {
  verifyIdToken.mockReset();
  batchSet.mockClear();
  batchUpdate.mockClear();
  batchDelete.mockClear();
  batchCommit.mockClear();
  docGet.mockReset();
  docGet.mockResolvedValue({ data: () => undefined });
  colGet.mockReset();
  colGet.mockResolvedValue({ docs: [] });
});

describe("POST /api/admin/mutations — enforcement", () => {
  it("401 sin encabezado Authorization", async () => {
    const res = await POST(request(null, medOp));
    expect(res.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("401 si el token no verifica", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const res = await POST(request("Bearer x", medOp));
    expect(res.status).toBe(401);
  });

  it("403 si el correo no está verificado", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: false });
    const res = await POST(request("Bearer x", medOp));
    expect(res.status).toBe(403);
  });

  it("403 si el rol no es administrador (operador)", async () => {
    verifyIdToken.mockResolvedValue({ email: "fhsvp2208@gmail.com", email_verified: true });
    const res = await POST(request("Bearer x", medOp));
    expect(res.status).toBe(403);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("200 admin: escribe medicamento + auditoría en un lote y confirma", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    const res = await POST(request("Bearer x", medOp));
    expect(res.status).toBe(200);
    // set del medicamento + set de la auditoría = 2 escrituras, un solo commit.
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledOnce();
    const audit = batchSet.mock.calls.map((c) => c[1] as Record<string, unknown>).find((d) => d.action === "medicine.create");
    expect(audit).toMatchObject({ actorEmail: "davidtencio@gmail.com", entityType: "medicine" });
  });

  it("200 admin en medicine.update: sincroniza lot y expiresAt con los lotes existentes del documento", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    docGet.mockResolvedValueOnce({
      data: () => ({
        lots: [{ id: "lot-1", lot: "LOTE-REAL", expiresAt: "2027-08-15", quantity: 12, receivedAt: "2026-01-01T00:00:00.000Z" }],
      }),
    });
    const res = await POST(request("Bearer x", { op: "medicine.update", id: "m1", fields: { ...medOp.fields, lot: "OTRO", expiresAt: "2099-01-01" } }));
    expect(res.status).toBe(200);
    expect(batchUpdate).toHaveBeenCalledOnce();
    expect(batchUpdate.mock.calls[0][1]).toMatchObject({ lot: "LOTE-REAL", expiresAt: "2027-08-15" });
  });

  it("200 admin en database.backup: devuelve todas las colecciones en JSON", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    colGet.mockResolvedValueOnce({
      docs: [{ id: "m1", ref: { id: "m1" }, data: () => ({ name: "Metformina", stock: 10 }) }],
    });
    const res = await POST(request("Bearer x", { op: "database.backup" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; backup: { exportedBy: string; collections: Record<string, unknown[]> } };
    expect(body.ok).toBe(true);
    expect(body.backup.exportedBy).toBe("davidtencio@gmail.com");
    expect(body.backup.collections.medicines).toEqual([{ id: "m1", name: "Metformina", stock: 10 }]);
  });

  it("database.reset exige la palabra LIMPIAR y borra todos los documentos existentes", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    const bad = await POST(request("Bearer x", { op: "database.reset", confirm: "NO" }));
    expect(bad.status).toBe(400);
    expect(batchDelete).not.toHaveBeenCalled();

    colGet.mockResolvedValueOnce({
      docs: [{ id: "m1", ref: { id: "m1" }, data: () => ({ name: "Metformina" }) }],
    });
    const ok = await POST(request("Bearer x", { op: "database.reset", confirm: "LIMPIAR" }));
    expect(ok.status).toBe(200);
    expect(batchDelete).toHaveBeenCalledOnce();
    expect(batchCommit).toHaveBeenCalledOnce();
  });

  it("400 admin con operación inválida (datos que el planificador rechaza)", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    const res = await POST(request("Bearer x", { op: "medicine.create", fields: { ...medOp.fields, name: "" }, initialStock: 0, pharmacistEmail: "" }));
    expect(res.status).toBe(400);
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
