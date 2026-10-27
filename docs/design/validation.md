# Validación del prototipo visual

Fecha: 17 de octubre de 2026.

Este documento conserva la validación del primer prototipo. Para las ampliaciones posteriores y los escenarios adicionales, consultar [Fase 2](phase-2.md).

## Alcance

Inspección visual y comprobaciones de interacción en Chromium del navegador integrado. Revisión de sintaxis y lint de los archivos del repositorio. No se cambió la aplicación Next.js, las dependencias, la autenticación, las reglas ni los datos de Firebase. No se realizó commit, push ni despliegue.

El diagnóstico inicial y el prototipo están preparados para revisión. No se declara completada la validación con usuarios de la fase 2 ni la integración de las fases 3 a 6.

## Resultado de las comprobaciones

| Comprobación | Resultado observado |
| --- | --- |
| `node --check docs/design/prototype/prototype.js` | Sin errores de sintaxis. |
| `node --check docs/design/serve.mjs` | Sin errores de sintaxis. |
| `npm run lint` | Finalizó con código 0, sin errores ni advertencias. |
| Servidor local | Responde en `127.0.0.1:4317`; sirve únicamente HTML, CSS y JavaScript del prototipo mediante una lista explícita. |
| Búsqueda por lote | `DEMO-CZ-02` devuelve solo Clonazepam. |
| Búsqueda sin acentos | `capsula` devuelve Tramadol, cuya forma es “Cápsula”. |
| Stock bajo | Devuelve solo Diazepam: 180 tabletas, mínimo 250. |
| Lotes vencidos | La acción “Revisar lote” devuelve solo Lorazepam y muestra su vencimiento del 31 de julio de 2026. |
| Lotes por vencer | Devuelve solo Midazolam; muestra 19 días respecto de la fecha fija de referencia. |
| Orden por existencia | Midazolam, Morfina, Diazepam, Tramadol, Clonazepam, Lorazepam. |
| Orden por vencimiento | Lorazepam, Midazolam, Morfina, Diazepam, Tramadol, Clonazepam. |
| Sin resultados | Una búsqueda inexistente muestra el estado vacío y 0 de 6. |
| Limpiar filtros | Restablece 6 de 6 y devuelve el foco a la búsqueda. |
| Detalle de lotes | Clonazepam muestra sus dos lotes, 250 y 180 tabletas; su suma corresponde a 430. |
| Última toma | Se presenta fecha, hora, responsable ficticio y naturaleza histórica del registro. |
| Cierre de detalle | Escape cierra el diálogo y devuelve el foco al botón “Ver detalle” de origen. |
| Vista previa de movimiento | Diálogo explícitamente DEMO, sin botón de guardar y sin mutaciones. |
| Navegación secundaria | “Movimientos” abre su descripción de alcance y permite volver al inventario. |
| Tema | Alternancia claro/oscuro conserva los datos mostrados y actualiza el nombre accesible del control. |
| Consola del navegador | Sin errores ni advertencias capturados al finalizar las comprobaciones. |

## Adaptación visual

Se verificaron anchos de viewport de 320, 390, 768, 1024 y 1440 px. El ancho de contenido puede ser menor por la barra vertical del navegador.

- 320 y 390 px: tarjetas compactas, navegación inferior y controles que se ajustan al ancho.
- 768 px: tabla con navegación inferior.
- 1024 y 1440 px: tabla y barra lateral; en 1024 se comprobó además que las celdas no desbordan horizontalmente.
- En las comprobaciones de 320, 768, 1024 y 1440 px no se detectaron controles fuera del ancho del contenido ni desplazamiento horizontal de la página.
- En 320 px, los diálogos de detalle y movimiento no presentaron desbordamiento horizontal; pueden desplazarse verticalmente si su contenido supera la altura disponible.
- Se inspeccionaron visualmente escritorio claro/oscuro y móvil; se guardaron capturas de ambos temas.

## Contraste calculado a partir de los tokens cargados

| Par | Claro | Oscuro |
| --- | ---: | ---: |
| Texto principal / superficie | 14,55:1 | 13,81:1 |
| Texto secundario / superficie | 5,50:1 | 8,34:1 |
| Texto secundario / fondo | 5,08:1 | 9,25:1 |
| Acción seleccionada / fondo de selección | 6,82:1 | 7,87:1 |
| Texto de alerta / fondo de alerta | 6,18:1 | 7,77:1 |
| Texto de advertencia / fondo de advertencia | 5,67:1 | 8,44:1 |
| Texto de botón principal / botón | 6,57:1 | 8,39:1 |
| Límite de campo / superficie | 3,38:1 | 3,94:1 |
| Límite de campo / fondo | 3,12:1 | 4,37:1 |

Los pares de texto revisados superan 4,5:1 y los límites de campos revisados superan 3:1. Esto es una verificación parcial de contraste, no una certificación de conformidad WCAG. Referencia: [WCAG 2.2 del W3C](https://www.w3.org/TR/WCAG22/).

## Evidencia visual

- [Escritorio claro](previews/desktop-light.png)
- [Escritorio oscuro](previews/desktop-dark.png)
- [Móvil claro](previews/mobile-light.png)
- [Móvil oscuro](previews/mobile-dark.png)

## Límites y trabajo pendiente

- Pendiente revisión del usuario y de operadores sobre densidad, tamaño de texto, indicadores y prioridad de las acciones.
- Pendientes pruebas con lector de pantalla, zoom manual al 200 %, otros navegadores y dispositivos físicos.
- La discrepancia tipográfica entre la captura original y el código local permanece sin diagnóstico de su causa en el despliegue.
- El prototipo utiliza datos fijos; la integración deberá probar límites de fechas, varios estados por medicamento, lotes sin saldo, ausencia de vencimiento y nombres/códigos extensos con los datos del modelo real.
- La suite funcional y el build de Next.js no se ejecutaron porque este hito solo agrega documentación y un prototipo independiente; sus resultados no se infieren del lint.
- Al integrar, se deben mantener permisos, auditoría, historial, baja/reactivación y semántica del conteo. Las reglas de disponibilidad operativa no se redefinen mediante las etiquetas visuales.
