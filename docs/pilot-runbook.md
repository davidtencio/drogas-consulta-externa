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

- Las mutaciones administrativas y su auditoría son escrituras consecutivas desde el cliente; una interrupción entre ambas puede dejar la auditoría incompleta. Antes de producción deben migrarse a una función backend que escriba datos y auditoría atómicamente.
- La lista de roles está versionada en código y reglas; no existe todavía administración centralizada de roles ni aprobación de altas/bajas.
- El monitoreo requiere revisión manual de Firestore; faltan alertas automáticas, retención formal y exportación a un repositorio de auditoría independiente.
- Las reglas deben validarse también con el emulador de Firestore antes de ampliar el piloto.
