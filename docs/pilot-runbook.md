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

- **Resuelto (auditoría atómica):** las mutaciones administrativas (crear/editar medicamento y farmacéutico, alta/baja) y su registro de auditoría —más el movimiento de existencia inicial— ahora se persisten en un único `writeBatch` de Firestore, atómico y compatible con el modo sin conexión. Ya no puede quedar una auditoría incompleta si la operación se interrumpe (`app/lib/db.ts`).
- **Pendiente (enforcement server-side):** el batch garantiza atomicidad, pero la escritura sigue originándose en el cliente. Para impedir que un cliente comprometido omita o falsifique la auditoría, la siguiente mejora es mover estas mutaciones a un backend con `firebase-admin` (route handler de la app en App Hosting o Cloud Function) que verifique el rol y escriba con privilegios de administrador, y endurecer las reglas para denegar la escritura directa del cliente en `medicines`/`pharmacists`/`auditLogs`. Requiere credenciales del proyecto en vivo para validar antes de forzarlo.
- La lista de roles está versionada en código y reglas; no existe todavía administración centralizada de roles ni aprobación de altas/bajas.
- El monitoreo requiere revisión manual de Firestore; faltan alertas automáticas, retención formal y exportación a un repositorio de auditoría independiente.
- Las reglas deben validarse también con el emulador de Firestore antes de ampliar el despliegue.

## Endurecimiento aplicado para producción

- **Cabeceras de seguridad HTTP** en todas las rutas (`next.config.ts`): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (anti-clickjacking), `Referrer-Policy` y `Permissions-Policy`. Queda pendiente una CSP de recursos (`script-src`/`connect-src`) que debe ajustarse a los orígenes de Firebase Auth/Firestore y validarse en vivo antes de forzarla.
- **Producción plena:** `NEXT_PUBLIC_PILOT_MODE=0` (sin banner de piloto) y `NEXT_PUBLIC_DEMO_MODE=0`. `apphosting.yaml` no define estas variables, por lo que el valor por defecto (`0`) aplica en el despliegue.
