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
verde. Esto confirma que el `proxy.ts` se ejecuta en el despliegue, **no** que el
navegador no bloquee nada al usar la app (ver pendiente 2).

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

## PENDIENTES para retomar (configuración en Firebase/GCP, no código)

1. **Secreto `FIREBASE_SERVICE_ACCOUNT`** en GitHub → el workflow de reglas falló
   una vez por faltar (guard intencional, no rompió nada). Crear cuenta de servicio
   con rol **Firebase Rules Admin**, guardar su clave JSON como secreto del repo, y
   re-ejecutar el workflow desde Actions. Pasos en `docs/deploy-firestore-rules.md`.
   Sigue pendiente: en los runs del 2026-07-23 solo corrió el workflow de CI.
2. **Prueba de humo de la CSP forzada** — **sigue pendiente**. La parte automática
   ya está hecha (ver "Verificado en producción" arriba: la cabecera se emite bien
   y el nonce rota). Falta la parte de navegador: iniciar sesión con Google + una
   lectura/escritura de Firestore con la consola abierta. Si aparece una violación
   `Content-Security-Policy`, ajustar el origen/directiva en `proxy.ts`
   (`contentSecurityPolicy`) o revertir ese commit. Requiere sesión autenticada,
   por eso no se puede validar sin intervención manual.
3. **Orden de despliegue de reglas** (cuando toque publicarlas): primero
   `firebase deploy --only firestore:rules` (o el workflow), luego la app.

## Verificación local

`npm run lint` · `npm test` (suite completa) · `npm run test:a11y` · `npm run build`.
