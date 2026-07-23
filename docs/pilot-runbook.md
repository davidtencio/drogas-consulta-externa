# Guía operativa del piloto controlado

## Alcance y roles

El piloto usa dos perfiles aplicados tanto en la interfaz como en las reglas de Firestore:

- **Administrador:** administra catálogo y farmacéuticos, opera inventario y consulta la bitácora administrativa.
- **Operador:** consulta y registra movimientos o conteos. Solo puede modificar el campo `stock` mediante el flujo operativo.
- **No autorizado:** no puede leer ni escribir datos.

Las cuentas autorizadas se mantienen en `app/lib/authz.ts` y `firestore.rules`. Todo cambio debe hacerse en ambos lugares, revisarse por otra persona y desplegarse como una sola liberación.

## Preparación

1. Configure `NEXT_PUBLIC_PILOT_MODE=1` para mostrar el aviso visible del piloto.
2. Mantenga `NEXT_PUBLIC_DEMO_MODE=0`; el modo demo nunca debe usarse con datos reales.
3. Ejecute `npm test -- --run`, `npm run lint` y `npm run build`.
4. Confirme que las cuentas del piloto estén verificadas y aparezcan en la matriz de roles.
5. Despliegue primero las reglas de Firestore y luego la aplicación, dentro de la misma ventana controlada.

## Prueba de humo

- Un administrador puede abrir Configuración y ver la bitácora.
- Un operador no ve Configuración, pero puede registrar ingreso, egreso y conteo.
- Una cuenta fuera de la lista recibe la pantalla de acceso denegado.
- Un egreso superior al stock es rechazado.
- Los movimientos, auditorías e incidentes no se pueden editar ni borrar.

## Monitoreo y respuesta

Durante el piloto, revise diariamente `auditLogs` y `operationalEvents` en Firestore. Un error inesperado muestra una recuperación segura al usuario y registra ruta, mensaje y componente para el administrador, sin bloquear la interfaz si el reporte falla.

Detenga el piloto si hay stock negativo, pérdida de trazabilidad, acceso de una cuenta no autorizada o fallos repetidos que impidan una tarea crítica. Conserve los registros, desactive el acceso de las cuentas afectadas y revierta la aplicación y las reglas a la última versión validada.

## Riesgos residuales antes de producción

- **Resuelto (auditoría atómica y con enforcement server-side):** las mutaciones administrativas (crear/editar medicamento y farmacéutico, alta/baja) ya no las escribe el cliente. Se envían al backend `POST /api/admin/mutations` (route handler de Next en App Hosting, `app/api/admin/mutations/route.ts`), que verifica el ID token de Firebase y el rol de administrador del lado servidor y persiste el dato, su auditoría y el movimiento de existencia inicial en un **único lote atómico** con el Admin SDK. Las reglas de Firestore **niegan** la escritura directa del cliente en `medicines` (crear/eliminar), `pharmacists` (toda escritura) y `auditLogs`, por lo que la auditoría no puede omitirse ni falsificarse. La lógica de composición es pura y está probada (`app/lib/adminMutations.ts`), igual que el gating del endpoint (`route.test.ts`).
- La lista de roles está versionada en código y reglas; no existe todavía administración centralizada de roles ni aprobación de altas/bajas.
- El monitoreo requiere revisión manual de Firestore; faltan alertas automáticas, retención formal y exportación a un repositorio de auditoría independiente.
- Las reglas y el endpoint deben validarse también con el emulador de Firestore / un despliegue de prueba antes de ampliar el despliegue.

## Endurecimiento aplicado para producción

- **Backend con privilegios para el catálogo:** ver el punto de auditoría atómica arriba. El endpoint corre en el runtime de Node (no Edge) y usa **Application Default Credentials**: en App Hosting / Cloud Run las credenciales de la cuenta de servicio del runtime están disponibles automáticamente. Esa cuenta de servicio necesita permiso de lectura/escritura en Firestore: comprobado el 2026-07-23, `firebase-app-hosting-compute@…` ya lo tiene vía `roles/firebase.sdkAdminServiceAgent` (incluye `datastore.entities.*`), así que **no hace falta añadir `roles/datastore.user`**.
- **Cabeceras de seguridad HTTP** estáticas en todas las rutas (`next.config.ts`): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.
- **CSP forzada con nonce por petición:** un proxy (`proxy.ts`, la convención que sustituye a `middleware.ts` en Next.js 16) genera un nonce único por petición y envía la CSP completa como `Content-Security-Policy` (**forzada**, ya no Report-Only). `script-src` usa `'nonce-…' 'strict-dynamic'` en lugar de `'unsafe-inline'`: solo se ejecuta el script inline con el nonce del servidor (y los chunks que Next carga en cadena). El layout lee el nonce (`x-nonce`) y lo aplica al script de tema. `style-src` conserva `'unsafe-inline'` a propósito: la interfaz usa atributos `style={{}}` que los nonces no cubren y cuyo riesgo de inyección es bajo. Consecuencia: las páginas HTML se renderizan de forma **dinámica** (no estática), aceptable para esta app interna sobre Cloud Run.
  - **Validación en el despliegue:** haga una prueba de humo del **inicio de sesión con Google** y de lectura/escritura de Firestore justo después de desplegar; si algo se bloquea, la consola del navegador mostrará la violación de CSP. Reversión rápida: `git revert` del commit del proxy (la app vuelve a la CSP en Report-Only del commit anterior).
- **Producción plena:** `NEXT_PUBLIC_PILOT_MODE=0` (sin banner de piloto) y `NEXT_PUBLIC_DEMO_MODE=0`. `apphosting.yaml` no define estas variables, por lo que el valor por defecto (`0`) aplica en el despliegue.

## Orden de despliegue

1. Confirme el permiso de Firestore de la cuenta de servicio del runtime (IAM).
2. Despliegue primero las reglas de Firestore (`firebase deploy --only firestore:rules`) — endurecidas para negar la escritura del catálogo desde el cliente.
3. Despliegue la aplicación (incluye el nuevo endpoint) en la misma ventana controlada.
4. Prueba de humo: como administrador, cree y edite un medicamento y un farmacéutico, y verifique que el documento **y** su entrada en `auditLogs` aparecen juntos. Un intento de escritura directa del cliente al catálogo debe ser rechazado por las reglas.
