# Preparación de publicación del rediseño

Estado actualizado el 27 de octubre de 2026: el usuario autorizó llevar el rediseño a producción. Se repiten las comprobaciones técnicas antes del push a `main` y se verificará el despliegue en App Hosting. La hoja de aceptación en PC sigue sin resultados humanos registrados; la autorización de publicación no se presenta como una prueba de usabilidad realizada.

Destino: `drogas-consulta-externa`, backend homónimo en `us-east5`. Revisión anterior comprobada antes de publicar: `build-2026-07-23-011`, commit `2a6fb7cf53d5b7ee11f0e2e3ef8bc47bb2c29581`, con el 100 % del tráfico. Se conserva como referencia para una reversión de la aplicación. Esta entrega no modifica reglas, cuentas, permisos ni datos de producción.

## Artefactos separados

| Uso | Compilación | Inicio local | Directorio |
| --- | --- | --- | --- |
| Revisión ficticia por el usuario | `npm run build:demo` | `npm run start:demo` | `.next-demo`, puerto 3000, solo 127.0.0.1 |
| Entrega autenticada | `npm run build:release` | `npm run start -- --hostname 127.0.0.1 --port 3001` | `.next`, puerto 3001 para la prueba local |

La vista DEMO no requiere cuenta y no debe publicarse como entrega operativa. El script de entrega carga los archivos de entorno con la precedencia de Next y rechaza DEMO, valores ambiguos de los indicadores y el perfil de vista previa antes de compilar. No modifica archivos de entorno. Si el proceso tiene `NEXT_PUBLIC_DEMO_MODE=1`, retira esa variable o establece explícitamente `0` antes de compilar la entrega.

`npm run check:release` comprueba la configuración efectiva; **no examina una compilación anterior ni autoriza publicar**. `build:release` genera `.next/release-validation.json` con modo, indicador de piloto, fecha y BUILD_ID. `npm run smoke:release` exige que esa constancia coincida con el BUILD_ID actual y comprueba el servidor autenticado local del puerto 3001.

## Comprobaciones antes de preparar una revisión

1. Revisar el diff de todas las fases y conservar un identificador de revisión reproducible antes de publicar.
2. Ejecutar `npm run lint`, `npm test`, `npm run test:a11y` y `npm run test:release`.
3. Para permisos, usar `npm run test:rules`. Requiere Java 21 y Firebase CLI; se verificó con CLI 15.22.3. `firebase.validation.json` lee **firestore.rules** y arranca un proyecto ficticio `demo-consulta-externa-design` en 127.0.0.1:8088. No usar las reglas abiertas de `firebase.emulator.json` para demostrar permisos.
4. Ejecutar `npm run build:release`, iniciar ese artefacto en el puerto 3001 y ejecutar `npm run smoke:release`.
5. Completar la [aceptación en PC](acceptance-pc.md) y registrar hallazgos, correcciones y decisión. No inferir aprobación de una compilación o de pruebas automáticas.

El workflow CI ejecuta las pruebas, accesibilidad, protección de entrega y permisos del emulador. Su resultado remoto debe comprobarse para el commit publicado.

## Publicación posterior

- Confirmar la revisión exacta, aceptación y destino de prueba/publicación antes de enviar cambios. El repositorio está conectado a App Hosting; un push a la rama vinculada puede iniciar un despliegue.
- Verificar que el entorno de App Hosting tiene DEMO desactivado y elegir explícitamente si corresponde mostrar el aviso de piloto. Los valores públicos se incorporan durante la compilación.
- Para este rediseño, `firestore.rules`, `firebase.json`, `.firebaserc` y `apphosting.yaml` no cambian. No corresponde redeplegar reglas como parte de esta entrega visual. La guía histórica del piloto describe también despliegues de endurecimiento; no implica repetirlos aquí.
- En un entorno de prueba autorizado, completar Google OAuth y las operaciones autenticadas con cuentas por rol y datos sintéticos. La prueba local de API sin sesión solo demuestra su rechazo temprano, no una escritura real ni la configuración IAM del destino.
- En la versión publicada, verificar acceso, lectura, consola/CSP, una tarea permitida por rol y conservación de histórico. No alterar un registro de producción solo para probar el diseño.

## Reversión

Conservar la revisión anterior de App Hosting y su identificador antes de publicar. Ante una regresión visual u operativa, restaurar la aplicación a esa revisión mediante el procedimiento del entorno y comprobar acceso/lectura. Esta entrega no requiere migración de datos ni cambio de reglas. No revertir ni borrar movimientos, conteos o auditorías para deshacer una publicación gráfica.

No se ha probado una reversión remota en esta fase. La decisión de publicación y la comprobación en el destino se registran después de la aceptación y de la autorización para publicar.
