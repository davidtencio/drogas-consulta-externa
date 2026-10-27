# Fase 6 — validación técnica y preparación de entrega

Fecha de validación inicial: 17 de octubre de 2026. **Actualización del 27 de octubre: publicación autorizada por el usuario**, con repetición de la validación técnica y comprobación del destino según la [guía de entrega](release-checklist.md). La aceptación en PC sigue sin resultados humanos registrados. Esta fase corresponde al plan gráfico de `docs/design/README.md`.

## Cambios derivados de la revisión

1. Los diálogos aíslan el fondo con `inert`, bloquean el desplazamiento de la página y restauran ambos al cerrar. Actualizar el callback de cierre ya no reinicia el foco; Escape utiliza el callback vigente. Se mantienen ciclo de Tab, Shift+Tab y retorno al control de origen.
2. Un egreso rechazado por existencias insuficientes ahora asocia el error a Cantidad y mueve allí el foco, conservando medicamento, responsable y referencia para corregir y reintentar. Se añade una prueba integrada desde la página hasta la respuesta simulada de registro.
3. La recuperación ante un fallo inesperado usa el botón principal compartido y deja de afirmar que un incidente quedó registrado cuando ese reporte es de mejor esfuerzo. El cierre de mensajes críticos hereda el color legible y tiene un área de 44 px.
4. El comando de accesibilidad incorpora inventario, formularios, acceso, historial y toma de inventario. Se amplían los pares de texto, bordes de controles y foco evaluados en ambos temas. Son comprobaciones automáticas; no equivalen a una certificación WCAG.
5. Se añade una prueba real de reglas en Firestore Emulator, separada de la configuración abierta heredada, con proyecto ficticio y conexión limitada al emulador local.
6. Se preparan compilaciones independientes para revisión DEMO y entrega autenticada. La protección de entrega rechaza DEMO y configuraciones ambiguas. Se deja preparado CI para repetir estas comprobaciones y se documentan publicación y reversión.

## Evidencia local

| Área | Resultado y límite |
| --- | --- |
| Suite de aplicación | Última ejecución completa: 35 archivos y 284 pruebas aprobadas, incluidas las comprobaciones ampliadas de contraste y recuperación. |
| Accesibilidad | Última ejecución del comando ampliado: 8 archivos y 39 pruebas aprobadas. Axe no detectó infracciones en los casos evaluados. Se incluyen los pares adicionales de texto, controles y foco. |
| Protección de entrega | 7 pruebas Node aprobadas: modos autenticados admitidos y rechazo de DEMO, indicadores ambiguos y perfil de revisión. |
| Reglas ejecutadas | 5 pruebas en Firestore Emulator aprobadas contra `firestore.rules`, con Java 21 y Firebase CLI 15.22.3. Se comprueban lecturas por rol, correo verificado, rechazo de escrituras administrativas desde cliente, límites de saldo y atribución/inmutabilidad de movimientos y eventos. |
| Lint y compilación | Lint sin errores; compilaciones DEMO y autenticada aprobadas. No se añadieron dependencias. |
| Entrega HTTP | En 127.0.0.1:3001: `/` y `/arqueo` devuelven 200, CSP con nonce diferente por petición, sin unsafe-eval, X-Frame-Options DENY y nosniff. POST administrativo sin credenciales devuelve 401 antes de procesar una operación. |
| Navegador DEMO | `/` enfoca búsqueda; Enter abre detalle; Tab y Shift+Tab recorren el diálogo; Escape cierra y devuelve foco. Se verificó el aislamiento del fondo y la recuperación del desplazamiento. |
| Error y recuperación | Metformina ficticia: el intento de egreso 99999 se rechaza, Cantidad conserva su valor, recibe foco y aria-invalid. Corregir a 1 permite registrar y consultar saldo 319 desde 320. |
| Conteo | En otra sesión DEMO restablecida: confirmar un saldo registra una toma, limpia la selección y conserva Metformina en 320. |
| Adaptación | Inventario, Movimientos, Configuración y Toma de inventario comprobados a 320, 640 y 1280 px sin controles fuera del ancho ni desbordamiento horizontal de página. Los controles visibles medidos del inventario tienen al menos 44 px de altura. |
| Modal móvil | A 320 px en tema oscuro: contenido dentro del ancho y el centro de Confirmar movimiento recibe el toque, por encima de la navegación inferior. |
| Preferencias de acceso | Colores forzados y movimiento reducido emulados en Chromium a 640 px; detalle legible y acciones visibles. Se restablecieron las preferencias emuladas. No es una prueba de lector de pantalla o de dispositivo real. |

La compilación autenticada validada localmente tiene BUILD_ID `mbdInJf9Z7-jRdODYLsl5`. La constancia vive en `.next/release-validation.json`; deja de ser aplicable si se sustituye el artefacto. El servidor DEMO usa `.next-demo` y permanece disponible en 127.0.0.1:3000 para la revisión en PC.

## Aceptación humana y límites

El usuario confirmó que realizará la prueba en su PC. Se entrega la [hoja de aceptación](acceptance-pc.md), con tareas, resultados esperados y casillas pendientes. **No se han ejecutado tareas por el usuario, recogido su aprobación, medido tiempos humanos o aplicado SUS.** Tampoco se han comprobado navegador físico al 200 % de zoom, lector de pantalla ni un flujo OAuth completo en el destino de publicación.

La simulación de ancho a 640 px comprueba reflujo y ayuda a detectar problemas de ampliación; no se presenta como una prueba del zoom real al 200 %. La matriz de roles del emulador verifica permisos locales con tokens ficticios, sin demostrar la configuración desplegada, IAM o guardados autenticados en un entorno remoto.

No se modificaron reglas, permisos, datos reales, criterios clínicos ni archivos de entorno. No se hicieron commit, push, despliegue o reversión remota. Los controles CI están preparados localmente; no se afirma una ejecución de GitHub Actions.

## Entrega para continuar

- [Prueba en PC](acceptance-pc.md): ejecutar y registrar observaciones.
- [Preparación de publicación y reversión](release-checklist.md): comandos reproducibles y límites.
- [Error con foco en Cantidad](previews/phase6-error-recovery.png).
- [Detalle con colores forzados](previews/phase6-forced-colors.png).
- [Diálogo móvil oscuro](previews/phase6-modal-mobile-dark.png).
- [Versión DEMO lista para revisar en PC](previews/phase6-ready-for-pc.png).
- [Acceso de la compilación autenticada](previews/phase6-authenticated-release.png).

La parte técnica deja una candidata para aceptación. La fase no se considera aceptada ni publicada hasta registrar la prueba del usuario y resolver los hallazgos que impidan operar.
