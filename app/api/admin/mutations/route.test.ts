import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyIdToken = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const fakeDb = {
  collection: (name: string) => ({ doc: (id?: string) => ({ id: id ?? `auto-${name}` }) }),
  batch: () => ({ set: batchSet, update: batchUpdate, commit: batchCommit }),
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
  batchCommit.mockClear();
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

  it("400 admin con operación inválida (datos que el planificador rechaza)", async () => {
    verifyIdToken.mockResolvedValue({ email: "davidtencio@gmail.com", email_verified: true });
    const res = await POST(request("Bearer x", { op: "medicine.create", fields: { ...medOp.fields, name: "" }, initialStock: 0, pharmacistEmail: "" }));
    expect(res.status).toBe(400);
    expect(batchCommit).not.toHaveBeenCalled();
  });
});
