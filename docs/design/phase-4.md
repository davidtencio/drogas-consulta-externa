# Fase 4 — Inventario operativo

Fecha: 17 de octubre de 2026. Estado: integrado y verificado localmente. Sin commit, push ni despliegue.

## Resultado

La aplicación presenta una tabla comparativa en escritorio y tarjetas compactas en móvil. Las dos vistas utilizan los mismos datos y etiquetas. El detalle de cada medicamento permite consultar cantidades, lotes y la última toma de inventario disponible, e iniciar ingreso, egreso, conteo o consulta del historial mediante los recorridos existentes.

La revisión local se sirve en http://127.0.0.1:3000 con el modo DEMO activado para el proceso de compilación. No se modificaron archivos `.env`. El prototipo independiente de las fases 1–2 se conserva en `docs/design/prototype`.

## Cambios

| Elemento | Comportamiento |
| --- | --- |
| Tabla y tarjetas | Medicamento, concentración, forma, código, existencia registrada y unidad, mínimo, vencimiento y acceso al detalle. La tabla se muestra por encima de 700 px; en tamaños menores se utilizan tarjetas. |
| Indicadores | Número de medicamentos activos, con stock bajo, con lotes vencidos y con lotes por vencer. Se elimina el gran total que sumaba unidades distintas. |
| Búsqueda | Nombre, concentración, forma, código y números de lote, incluidos lotes agotados para localizar registros históricos. No distingue mayúsculas ni acentos. |
| Filtros | Todos, stock bajo, con lotes vencidos, con lotes por vencer, información por revisar, sin existencias y sin alertas. Se combinan con la búsqueda. |
| Orden | Nombre A–Z, cantidad registrada y vencimiento más cercano. Las fechas desconocidas quedan al final. |
| Detalle | Lotes almacenados, incluidos los agotados; cantidades, fechas y estados; responsable y fecha de la última toma disponible entre los movimientos cargados. |
| Acciones | Ingreso, egreso, conteo e historial reciben el identificador del medicamento seleccionado. Se cierra el detalle al abrir el formulario siguiente. |
| CSV | Exporta únicamente los medicamentos de la vista filtrada y en su orden actual. Incluye cantidad, unidad, mínimo, fecha más cercana, identificadores de lotes con saldo, origen del desglose e indicador de información por revisar. |
| Carga y error | Los indicadores muestran «—» mientras no hay datos confirmados. Un error de consulta ofrece reintento y se distingue tanto de una búsqueda sin coincidencias como de la ausencia de medicamentos activos. |

## Reglas conservadas y límites de lectura

- El stock bajo conserva la regla existente `stock <= minimumStock`. En igualdad se muestra «En el mínimo» y se mantiene su pertenencia al filtro de stock bajo. No se trasladó la comparación estricta del prototipo.
- Se reutilizan `expiryStatus`, `daysUntilExpiry` y su ventana inclusiva: vencimiento de hoy y hasta 30 días. No se alteraron estas funciones de dominio.
- La existencia principal se toma de `medicine.stock`; no se reemplaza por la suma de los lotes. Si ambos valores difieren, se muestra una observación y el filtro de información por revisar permite localizar el registro. La vista no concilia ni escribe cantidades.
- Las alertas de vencimiento del inventario se derivan de los lotes con saldo positivo. Un medicamento puede aparecer en vencidos y próximos a vencer simultáneamente; los grupos no son categorías excluyentes.
- Los lotes agotados siguen visibles en el detalle, pero no generan alertas sobre existencias actuales.
- Una fecha ausente o no interpretable se identifica como información pendiente. No se considera automáticamente vigente ni vencida.
- Si no existe un desglose de lotes almacenado y hay stock, se presenta una proyección de los campos generales ya existentes, con una nota explícita de su origen. No se inventan identificadores, fechas de recepción ni documentos nuevos, y no se realiza una migración.
- Una toma histórica no se presenta como certificación del saldo actual. La ausencia de una toma se limita a los registros consultados: la suscripción existente carga los últimos 200 movimientos.
- Los avisos se refieren a medicamentos **con lotes** vencidos o por vencer. No afirman que todas sus unidades tengan el mismo estado ni determinan aptitud de dispensación.

## Implementación

`useInventoryData` mantiene la lectura del catálogo. Se añadió manejo del error de esa suscripción, retirada de datos anteriores cuando falla y reintento que renueva las suscripciones. No se añadieron permisos ni escrituras de Firestore.

`inventoryView.ts` concentra las proyecciones de solo lectura, los filtros, la búsqueda, el orden y los conteos. `InventoryPanel` comparte esas proyecciones entre la tabla y las tarjetas; `InventoryLabels` mantiene las etiquetas coherentes; `InventoryDetail` conserva las acciones y el historial mediante callbacks existentes.

El almacén DEMO ahora incluye tres lotes ficticios de Clonazepam. Sus ingresos y egresos actualizan cantidades y asignaciones únicamente en memoria, para poder comprobar la nueva interfaz. El único cambio en `db.ts` reenvía los lotes recibidos dentro de su rama `DEMO_MODE`; la transacción de producción permanece intacta.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Suite completa | 31 archivos, 262 pruebas pasadas. Incluye proyección heredada, stock en el mínimo, lotes mixtos, saldo cero, fechas desconocidas, límites de vencimiento, búsqueda, orden, exportación, errores de suscripción y regresiones existentes. |
| Pruebas adicionales de cierre | Avisos de vencimiento y CSV revisados tras los ajustes de texto y origen del desglose. |
| Tipos, lint y build | Comprobación de TypeScript y lint sin errores; compilación Next.js de demostración completada. |
| Accesibilidad automática | Las comprobaciones axe añadidas para la tabla y el detalle no detectaron infracciones. No equivalen a una auditoría completa de accesibilidad. |
| Filtros en navegador | El filtro de vencidos devuelve Clonazepam y Salbutamol en el juego DEMO. Buscar `DEMO-CZ-PROXIMO` devuelve solo Clonazepam. |
| CSV descargado | Archivo revisado con una cabecera y una fila de Clonazepam para esa búsqueda. Conserva 96 unidades y los tres identificadores de lote de su saldo inicial. |
| Egreso DEMO | Desde el detalle: 96 → 95 unidades; el lote correspondiente pasa de 6 → 5. El historial contiene `DEMO-FASE-4` y su asignación de lote. Sin discrepancia de cantidades. |
| Ingreso DEMO | Dos lotes nuevos de 2 y 3 unidades: saldo 96 → 101, cinco lotes visibles y ausencia de discrepancia. |
| Conteo | El acceso desde el detalle abre el formulario con el saldo vigente de 101 y mantiene el mensaje de que el conteo no modifica existencias. Se cerró sin registrar. |
| Adaptación | Anchos 320, 390, 768, 1024 y 1440 px: sin desbordamiento horizontal, controles fuera del ancho disponible ni celdas visibles desbordadas. |
| Detalle en 320 px | Ancho interior y ancho desplazable iguales; botones dentro del viewport y cierre con Escape. |
| Temas | Revisión de móvil claro/oscuro y capturas de escritorio y detalle. |
| Consola final | Sin errores ni advertencias capturados durante la revisión de la versión compilada. |

Las pruebas de recuperación de error usan suscripciones de Firebase simuladas. No se provocaron fallos de permisos ni se modificaron datos reales para comprobar esa ruta. Las pruebas de movimientos se hicieron exclusivamente en el almacén ficticio del modo DEMO; la recarga restablece su estado inicial.

## Capturas

- [Tabla de escritorio](previews/phase4-app-desktop.png)
- [Detalle de tres lotes](previews/phase4-app-lots.png)
- [Tarjetas móviles](previews/phase4-app-mobile.png)
- [Tarjetas móviles en oscuro](previews/phase4-app-mobile-dark.png)

## Pendiente del plan

La fase 5 renovará los formularios y las pantallas de Movimientos, Configuración, Toma de inventario e inicio de sesión. La fase 6 completará la evaluación con operadores, accesibilidad manual, dispositivos y navegadores adicionales y preparación de publicación.

Esta entrega no cambia reglas, roles, autenticación, auditoría ni persistencia de conteos. No incluye pruebas contra datos de producción ni validación de reglas en Emulator. El artefacto local se compiló para DEMO y no debe utilizarse como un despliegue operativo.
