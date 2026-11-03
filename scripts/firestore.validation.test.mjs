import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, terminate, setLogLevel } from "firebase/firestore";

const projectId = "demo-consulta-externa-design";
// No usar la configuración abierta heredada ni una base remota por accidente.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8088", "Ejecute npm run test:rules contra el emulador aislado.");
// Los rechazos son resultados esperados; cada uno se comprueba por su código.
setLogLevel("silent");
const clients = [];
function client(email, verified = true) {
  const app = initializeApp({ projectId, apiKey: "demo-only", appId: "demo-only" }, `validation-${clients.length}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8088, email ? { mockUserToken: { sub: `user-${clients.length}`, email, email_verified: verified } } : undefined);
  clients.push({ app, db });
  return db;
}
const admin = client("davidtencio@gmail.com");
const operator = client("fhsvp2208@gmail.com");
const outsider = client("sin-rol@demo.local");
const unverified = client("davidtencio@gmail.com", false);
const anonymous = client();
const denied = (operation) => assert.rejects(operation, (error) => error.code === "permission-denied");
const medicine = { name: "Presentación DEMO", stock: 10 };

before(async () => {
  for (const collection of ["medicines", "pharmacists", "movements", "auditLogs", "operationalEvents"]) {
    const response = await fetch(`http://127.0.0.1:8088/v1/projects/${projectId}/databases/(default)/documents/${collection}/seed`, {
      method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { name: { stringValue: medicine.name }, stock: { integerValue: "10" } } }),
    });
    assert.equal(response.ok, true, `No se pudo preparar ${collection}: ${response.status}`);
  }
});
after(async () => { await Promise.all(clients.map(async ({ app, db }) => { await terminate(db); await deleteApp(app); })); });

test("administrador y operador leen el catálogo; anónimo, no autorizado y correo no verificado no pueden", async () => {
  for (const db of [admin, operator]) assert.equal((await getDoc(doc(db, "medicines/seed"))).exists(), true);
  for (const db of [anonymous, outsider, unverified]) await denied(() => getDoc(doc(db, "medicines/seed")));
});
test("solo el administrador lee auditorías y eventos operativos", async () => {
  for (const collection of ["auditLogs", "operationalEvents"]) {
    assert.equal((await getDoc(doc(admin, `${collection}/seed`))).exists(), true);
    await denied(() => getDoc(doc(operator, `${collection}/seed`)));
  }
});
test("el cliente no crea, elimina ni edita identificación del catálogo, incluso siendo administrador", async () => {
  for (const db of [admin, operator]) {
    await denied(() => setDoc(doc(db, "medicines/new"), medicine));
    await denied(() => deleteDoc(doc(db, "medicines/seed")));
    await denied(() => updateDoc(doc(db, "medicines/seed"), { name: "Cambio no permitido" }));
    for (const collection of ["pharmacists", "auditLogs"]) {
      await denied(() => setDoc(doc(db, `${collection}/new`), { name: "DEMO" }));
      await denied(() => updateDoc(doc(db, `${collection}/seed`), { name: "Cambio" }));
      await denied(() => deleteDoc(doc(db, `${collection}/seed`)));
    }
  }
});
test("el operador puede actualizar saldo, lotes y última toma; se rechaza stock negativo y una cuenta sin rol", async () => {
  await updateDoc(doc(operator, "medicines/seed"), { stock: 9, lots: [], lot: "DEMO", expiresAt: "2099-01-01", lastCountAt: "2026-10-31T10:00:00.000Z", lastCountBy: "fhsvp2208@gmail.com" });
  assert.equal((await getDoc(doc(operator, "medicines/seed"))).data().stock, 9);
  await denied(() => updateDoc(doc(operator, "medicines/seed"), { stock: -1 }));
  await denied(() => updateDoc(doc(outsider, "medicines/seed"), { stock: 8 }));
});
test("movimientos y eventos exigen actor propio; solo ingresos/egresos se editan con actor propio y nada se borra", async () => {
  for (const collection of ["movements", "operationalEvents"]) {
    await setDoc(doc(operator, `${collection}/own`), { actorEmail: "fhsvp2208@gmail.com", type: "DEMO" });
    await denied(() => setDoc(doc(operator, `${collection}/forged`), { actorEmail: "davidtencio@gmail.com" }));
    await denied(() => setDoc(doc(outsider, `${collection}/outsider`), { actorEmail: "sin-rol@demo.local" }));
    for (const db of [admin, operator]) {
      await denied(() => updateDoc(doc(db, `${collection}/own`), { type: "EDIT" }));
      await denied(() => deleteDoc(doc(db, `${collection}/own`)));
    }
  }
  await setDoc(doc(operator, "movements/mov-out"), { actorEmail: "fhsvp2208@gmail.com", type: "OUT", quantity: 5, medicineName: "X", createdAt: "2026-11-01T10:00:00.000Z" });
  const firstEdit = { editedAt: "2026-11-02T10:00:00.000Z", editedByEmail: "fhsvp2208@gmail.com", previous: { type: "OUT", quantity: 5, medicineName: "X" } };
  await updateDoc(doc(operator, "movements/mov-out"), { actorEmail: "fhsvp2208@gmail.com", type: "OUT", quantity: 3, editHistory: [firstEdit] });
  await denied(() => updateDoc(doc(operator, "movements/mov-out"), { actorEmail: "davidtencio@gmail.com", type: "OUT", quantity: 2 }));
  await denied(() => deleteDoc(doc(operator, "movements/mov-out")));
});
test("cada edición agrega la versión anterior fiel al historial y no reescribe el pasado", async () => {
  const actor = "fhsvp2208@gmail.com";
  const ref = doc(operator, "movements/hist");
  await setDoc(ref, { actorEmail: actor, type: "OUT", quantity: 5, medicineName: "X", prescriptionRef: "RX-1", createdAt: "2026-11-01T10:00:00.000Z" });
  const e1 = { editedAt: "2026-11-02T10:00:00.000Z", editedByEmail: actor, previous: { type: "OUT", quantity: 5, medicineName: "X", prescriptionRef: "RX-1" } };
  // Sin historial, con versión anterior falsa, con otro editor o cambiando la fecha original: rechazado.
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 3 }));
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 3, editHistory: [{ ...e1, previous: { ...e1.previous, quantity: 9 } }] }));
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 3, editHistory: [{ ...e1, editedByEmail: "davidtencio@gmail.com" }] }));
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 3, createdAt: "2026-11-02T00:00:00.000Z", editHistory: [e1] }));
  await updateDoc(ref, { actorEmail: actor, quantity: 3, editHistory: [e1] });
  const e2 = { editedAt: "2026-11-03T10:00:00.000Z", editedByEmail: actor, previous: { type: "OUT", quantity: 3, medicineName: "X", prescriptionRef: "RX-1" } };
  // Reescribir o borrar la entrada anterior: rechazado.
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 4, editHistory: [{ ...e1, editedAt: "2020-01-01T00:00:00.000Z" }, e2] }));
  await denied(() => updateDoc(ref, { actorEmail: actor, quantity: 4, editHistory: [e2] }));
  await updateDoc(ref, { actorEmail: actor, quantity: 4, editHistory: [e1, e2] });
  assert.equal((await getDoc(ref)).data().editHistory.length, 2);
});
test("un egreso se anula (no se borra) solo con motivo y actor propio, y lo anulado ya no se modifica", async () => {
  const voidFields = { actorEmail: "fhsvp2208@gmail.com", voidedByEmail: "fhsvp2208@gmail.com", voidedAt: "2026-11-02T10:00:00.000Z", voidReason: "Receta duplicada por error" };
  await setDoc(doc(operator, "movements/void-in"), { actorEmail: "fhsvp2208@gmail.com", type: "IN", quantity: 5 });
  await denied(() => updateDoc(doc(operator, "movements/void-in"), voidFields));
  await setDoc(doc(operator, "movements/void-out"), { actorEmail: "fhsvp2208@gmail.com", type: "OUT", quantity: 5 });
  await denied(() => updateDoc(doc(operator, "movements/void-out"), { ...voidFields, voidReason: "corto" }));
  await denied(() => updateDoc(doc(operator, "movements/void-out"), { ...voidFields, voidedByEmail: "davidtencio@gmail.com" }));
  await denied(() => updateDoc(doc(operator, "movements/void-out"), { ...voidFields, quantity: 1 }));
  await updateDoc(doc(operator, "movements/void-out"), voidFields);
  await denied(() => updateDoc(doc(operator, "movements/void-out"), { actorEmail: "fhsvp2208@gmail.com", type: "OUT", quantity: 2, editHistory: [{ editedAt: "2026-11-03T10:00:00.000Z", editedByEmail: "fhsvp2208@gmail.com", previous: { type: "OUT", quantity: 5 } }] }));
  await denied(() => deleteDoc(doc(operator, "movements/void-out")));
});
