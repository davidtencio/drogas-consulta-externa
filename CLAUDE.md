# Memoria del proyecto — Control de Drogas (Consulta Externa)

App Next.js 16 (App Router) + Firebase (Auth Google, Firestore) sobre Firebase
App Hosting (SSR en Cloud Run). Lógica de dominio pura en `app/lib/`, con pruebas
Vitest colocadas junto al código. Ver `README.md` y `docs/pilot-runbook.md`.

## Estado de producción (2026-07-23)

La app se endureció para producción plena. Todo lo siguiente ya está en `main`:

- **Enforcement server-side del catálogo:** las mutaciones administrativas
  (crear/editar medicamento y farmacéutico, alta/baja) pasan por
  `POST /api/admin/mutations` (`app/api/admin/mutations/route.ts`), que verifica
  el ID token + rol admin y escribe el dato + auditoría + movimiento inicial en un
  lote atómico con el Admin SDK (`app/lib/adminMutations.ts`, `app/server/adminApp.ts`).
- **Reglas Firestore endurecidas:** el cliente no escribe catálogo, farmacéuticos
  ni `auditLogs`; el operador solo ajusta `stock`/`lots`/`lot`/`expiresAt`.
- **Despliegue automático de reglas:** `.github/workflows/deploy-firestore-rules.yml`
  (ver `docs/deploy-firestore-rules.md`).
- **CSP forzada con nonce por petición:** `proxy.ts` + nonce en `app/layout.tsx`.
  `script-src 'nonce-…' 'strict-dynamic'` (sin `'unsafe-inline'`); `style-src`
  conserva `'unsafe-inline'` a propósito. Usar nonces hace las páginas dinámicas.
  El archivo se llama `proxy.ts` y exporta `proxy(request)` porque Next 16 deprecó
  la convención `middleware`; el nombre del export importa (Next resuelve
  `mod.proxy`). La CSP, el nonce y el `matcher` no cambiaron con el renombrado.
- Cabeceras de seguridad estáticas en `next.config.ts`. Flags demo/piloto en `0`.

### Verificado en producción (2026-07-23, revisión `build-2026-07-23-005`)

Contra `https://drogas-consulta-externa--drogas-consulta-externa.us-east5.hosted.app`:
HTTP 200; cabecera `Content-Security-Policy` forzada con `script-src 'self'
'nonce-…' 'strict-dynamic'` y sin `'unsafe-inline'`; nonce distinto en cada
petición; `Strict-Transport-Security` y `X-Frame-Options: DENY` presentes. CI en
verde. Esto confirma que el `proxy.ts` se ejecuta en el despliegue.

### Prueba de humo de la CSP: SUPERADA (2026-07-23, revisión `build-2026-07-23-007`)

Ejercicio manual en navegador contra producción: inicio de sesión con Google,
carga del inventario y un movimiento. **Consola sin una sola violación de
`Content-Security-Policy`.** React hidrata con normalidad, así que
`'strict-dynamic'` no rompe la cadena de chunks de Next.

Detalle a no confundir con un fallo: con sesión iniciada hay 19 scripts en la
página y solo 18 llevan nonce. El que no lo lleva es
`https://apis.google.com/js/api.js`, cargado por el SDK de Firebase Auth. Es el
comportamiento correcto de `'strict-dynamic'`: la confianza se propaga desde el
script con nonce que lo inyecta. Que se ejecute sin bloqueo es precisamente la
prueba de que la cadena funciona en el flujo de auth real.

Sondas dirigidas complementarias (sin sesión, desde la consola de la página):
`fetch` a `firestore.googleapis.com` → HTTP 400 y a `identitytoolkit.googleapis.com`
→ HTTP 403 (respuestas del servidor, no bloqueos de CSP), e iframe de
`drogas-consulta-externa.firebaseapp.com/__/auth/iframe` cargado sin problema.
Es decir, `connect-src` y `frame-src` cubren los orígenes que la app necesita.

### IAM del runtime: NO hace falta tocar nada (comprobado 2026-07-23)

Una versión anterior de este archivo listaba como pendiente dar `roles/datastore.user`
a la cuenta de servicio del runtime. Era una suposición y resultó falsa. La cuenta es
`firebase-app-hosting-compute@drogas-consulta-externa.iam.gserviceaccount.com` y ya
tiene `roles/firebase.sdkAdminServiceAgent`, que incluye `datastore.entities.create`,
`.update`, `.delete`, `.get` y `.list` — justo lo que `/api/admin/mutations` necesita
vía Application Default Credentials. Además, los logs de Cloud Run del servicio no
registran ningún `PERMISSION_DENIED` en 30 días. Decisión: no se añade el binding.

Matiz: `sdkAdminServiceAgent` es un rol de *agente de servicio* y su contenido lo
define Google. Si algún día aparece "No se pudo guardar el cambio" al crear o editar
catálogo, revisar primero si ese rol dejó de incluir los permisos de datastore y, en
ese caso, añadir el binding explícito:
`gcloud projects add-iam-policy-binding drogas-consulta-externa --member="serviceAccount:firebase-app-hosting-compute@drogas-consulta-externa.iam.gserviceaccount.com" --role="roles/datastore.user"`.
No se validó ejecutando una mutación real en producción (requiere un ID token de
admin); la evidencia es de permisos y logs.

### Despliegue de reglas por Workload Identity Federation (2026-07-23)

El secreto `FIREBASE_SERVICE_ACCOUNT` que este archivo pedía **ya no existe ni hace
falta**: la organización prohíbe crear claves de cuenta de servicio
(`iam.disableServiceAccountKeyCreation`), así que el workflow se migró a WIF —
pool `github-actions`, proveedor OIDC `github` limitado al repo
`davidtencio/drogas-consulta-externa`, y `github-rules-deployer` (solo
`roles/firebaserules.admin`) suplantable desde ahí. Sin claves ni secretos que
rotar. Detalle en `docs/deploy-firestore-rules.md`.

### Reglas endurecidas: PUBLICADAS por fin (2026-07-23)

**Hallazgo importante:** las reglas endurecidas se fusionaron a `main` el 2026-07-23
pero **nunca se habían publicado**, porque el workflow jamás pudo correr por falta
de credencial. Producción estuvo una semana con el ruleset del 2026-07-16, en el que
el cliente aún podía crear/borrar catálogo y farmacéuticos y **escribir en
`auditLogs`**. Al arreglar la autenticación, el primer run publicó las reglas del
repo: ruleset `ceb60e51-1836-4199-b463-cb6aca305e25`, verificado byte a byte contra
`firestore.rules`.

Lección para la próxima: que las reglas estén en `main` no significa que estén
publicadas. Comprobar el ruleset activo, no el archivo del repo.

Respaldo del ruleset anterior (`0058a2d0-662c-434f-9975-7ee29d33d8ab`, sigue vivo en
Firebase) en `C:\Users\david\Documents\firestore-rules-backup-2026-07-16.rules`,
fuera del repo a propósito.

## Anulación de egresos (2026-11-02)

Un egreso que no correspondía se **anula**, no se borra (trazabilidad de drogas
controladas). Botón "Anular" en Movimientos → motivo obligatorio (≥10 caracteres)
→ transacción que reintegra la cantidad a `stock` y a los mismos lotes de
`lotAllocations`, y agrega `voidedAt`/`voidedByEmail`/`voidReason` al movimiento.
Lo anulado se ve tachado, no suma en el resumen, sale en el CSV con su estado y ya
no se puede editar ni volver a anular. Las reglas lo hacen cumplir (`isValidVoid`):
solo `OUT`, solo esos campos + `actorEmail`, y `!('voidedAt' in resource.data)`.
Lógica en `prepareMovementVoid` (`app/lib/lots.ts`). Los ingresos no se anulan
(sus lotes pueden haber tenido egresos después); para corregirlos está "Editar".

**Publicado (2026-11-02):** PR #44 fusionado en `main` (merge `276a8ae`). El workflow
"Desplegar reglas de Firestore" (run `41537698615`) terminó en verde a las 22:31 UTC:
validación de invariantes, autenticación WIF y `firebase deploy --only
firestore:rules` correctos. Las reglas se publicaron antes de que terminara el build
de la app. **No verificado aún:** el ruleset activo en la consola de Firebase (que
contenga `isValidVoid`) ni una anulación real en producción.

## Aviso de toma posterior e historial de ediciones (2026-11-03)

Revisión de conciliación (prueba de estrés de ~7.200 operaciones aleatorias en demo):
`stock == Σlotes` y `stock − (ingresos − egresos no anulados)` constante tras cada
ingreso, egreso, edición y anulación. Los dos riesgos que quedaban se cubrieron así:

- **Toma posterior:** editar o anular un movimiento anterior a la última toma del
  medicamento (`countAfterMovement`, `app/lib/movements.ts`) muestra un aviso y exige
  confirmar que la diferencia de esa toma no se ajustó ya; si no, se duplica el ajuste.
  Al editar se miran el medicamento original y el destino.
- **Historial de ediciones:** cada edición agrega a `editHistory` la versión anterior
  (`appendEditHistory`). Las reglas (`isValidEdit`) exigen que el historial solo crezca,
  que la nueva entrada copie fielmente el documento anterior, que la firme quien edita
  y que `createdAt` no cambie. Ojo: en reglas, `list[0:0]` lanza error; por eso el
  `before.size() == 0 ||`. Movimientos editados antes de esto muestran "Editado (sin
  historial)". En Movimientos, "Editado N veces" abre el historial; CSV con "Ediciones".

## Módulo Analítica (2026-11-03)

Pestaña "Analítica" (solo admin) en la barra lateral. Primera medición: anulaciones.
Ranking de medicamentos con más egresos anulados (por fecha de anulación, con
unidades reintegradas) y de farmacéuticos: egresos anulados + ingresos corregidos
(entradas de `editHistory` cuya versión anterior era `IN`), porque los ingresos no
se anulan, se editan. Se agrupa por el **Responsable** del movimiento
(`pharmacistEmail`; en un ingreso corregido, el de la versión anterior).
Período: 30/90 días, 12 meses o todo. Lógica pura en `app/lib/analytics.ts`; datos en
`app/hooks/useAnalyticsData.ts` con dos consultas `where("voidedAt" | "updatedAt", ">", "")`
(índices simples automáticos, no lee toda la colección; las reglas ya permiten leer
`movements` a operadores). **No** usar `voidedByEmail`/`editedByEmail`: son la cuenta
con sesión iniciada (a menudo compartida) y la primera versión, que los usaba, mostraba
ese correo en vez del farmacéutico (corregido 2026-11-03 a pedido del usuario).

## PENDIENTES para retomar

1. **Probar en caliente una mutación de admin** (crear o editar un medicamento en
   producción). Es el camino que las reglas nuevas cambian y que aún no se ha
   ejercitado: ahora `medicines`/`pharmacists` solo se escriben desde
   `/api/admin/mutations`. Si aparece "No se pudo guardar el cambio", revisar el IAM
   del runtime (ver sección de IAM arriba) antes que las reglas.
2. **Acciones con Node 20 deprecado**: `actions/checkout@v4`, `actions/setup-node@v4`
   y `google-github-actions/auth@v2` se fuerzan a Node 24 en el runner. No rompe hoy;
   actualizar cuando haya versiones nuevas.
3. **Probar en caliente la anulación de un egreso**: registrar un egreso de prueba,
   anularlo con motivo y confirmar que `stock` y lotes vuelven a su valor. Antes,
   comprobar en la consola que el ruleset activo contiene `isValidVoid`; si "Anular"
   da permiso denegado, es que las reglas no están publicadas.
4. **Orden de despliegue de reglas** (cuando toque publicarlas): primero
   `firebase deploy --only firestore:rules` (o el workflow), luego la app.

## Verificación local

`npm run lint` · `npm test` (suite completa) · `npm run test:a11y` · `npm run build`.
