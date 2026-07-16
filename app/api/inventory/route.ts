import { env } from "cloudflare:workers";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS pharmacists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, license TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS medicines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, strength TEXT NOT NULL, form TEXT NOT NULL, unit TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), minimum_stock INTEGER NOT NULL DEFAULT 0, lot TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS movements (id INTEGER PRIMARY KEY AUTOINCREMENT, medicine_id INTEGER NOT NULL, type TEXT NOT NULL CHECK(type IN ('IN','OUT')), quantity INTEGER NOT NULL CHECK(quantity > 0), prescription_ref TEXT NOT NULL DEFAULT '', pharmacist_email TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(medicine_id) REFERENCES medicines(id))`,
  `CREATE INDEX IF NOT EXISTS movements_medicine_idx ON movements(medicine_id, created_at DESC)`,
];

async function ensureSchema() {
  await env.DB.batch(schemaStatements.map((sql) => env.DB.prepare(sql)));
}

function userEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email") || "demo@farmacia.local";
}

export async function GET() {
  await ensureSchema();
  const [medicines, pharmacists, movements] = await env.DB.batch([
    env.DB.prepare("SELECT id,name,strength,form,unit,stock,minimum_stock AS minimumStock,lot,expires_at AS expiresAt,active FROM medicines WHERE active=1 ORDER BY name"),
    env.DB.prepare("SELECT id,name,email,license,active FROM pharmacists ORDER BY name"),
    env.DB.prepare("SELECT m.id,m.type,m.quantity,m.prescription_ref AS prescriptionRef,m.pharmacist_email AS pharmacistEmail,m.created_at AS createdAt, d.name AS medicineName FROM movements m JOIN medicines d ON d.id=m.medicine_id ORDER BY m.id DESC LIMIT 8"),
  ]);
  return Response.json({ medicines: medicines.results, pharmacists: pharmacists.results, movements: movements.results });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  const now = new Date().toISOString();

  if (action === "medicine") {
    const name = String(body.name || "").trim();
    const strength = String(body.strength || "").trim();
    if (!name || !strength) return Response.json({ error: "Nombre y concentración son obligatorios." }, { status: 400 });
    const result = await env.DB.prepare("INSERT INTO medicines (name,strength,form,unit,stock,minimum_stock,lot,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(name, strength, String(body.form || "Tableta"), String(body.unit || "unidades"), Math.max(0, Number(body.stock) || 0), Math.max(0, Number(body.minimumStock) || 0), String(body.lot || ""), String(body.expiresAt || ""), now).run();
    return Response.json({ id: result.meta.last_row_id }, { status: 201 });
  }

  if (action === "pharmacist") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const license = String(body.license || "").trim();
    if (!name || !email || !license) return Response.json({ error: "Complete todos los datos del farmacéutico." }, { status: 400 });
    await env.DB.prepare("INSERT INTO pharmacists (name,email,license,created_at) VALUES (?,?,?,?)").bind(name,email,license,now).run();
    return Response.json({ ok: true }, { status: 201 });
  }

  if (action === "movement") {
    const medicineId = Number(body.medicineId);
    const quantity = Number(body.quantity);
    const type = body.type === "IN" ? "IN" : "OUT";
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(medicineId)) return Response.json({ error: "Cantidad inválida." }, { status: 400 });
    const delta = type === "IN" ? quantity : -quantity;
    const update = await env.DB.prepare("UPDATE medicines SET stock=stock+? WHERE id=? AND stock+? >= 0").bind(delta, medicineId, delta).run();
    if (!update.meta.changes) return Response.json({ error: "Existencias insuficientes o medicamento no disponible." }, { status: 409 });
    try {
      await env.DB.prepare("INSERT INTO movements (medicine_id,type,quantity,prescription_ref,pharmacist_email,created_at) VALUES (?,?,?,?,?,?)")
        .bind(medicineId,type,quantity,String(body.prescriptionRef || ""),userEmail(request),now).run();
    } catch (error) {
      await env.DB.prepare("UPDATE medicines SET stock=stock-? WHERE id=?").bind(delta, medicineId).run();
      throw error;
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Acción no reconocida." }, { status: 400 });
}
