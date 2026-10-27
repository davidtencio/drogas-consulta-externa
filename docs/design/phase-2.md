# Fase 2 — Prototipo visual y estados de uso

Fecha: 17 de octubre de 2026. Estado: desarrollo del prototipo y comprobación técnica realizados; revisión con usuarios pendiente. No integrado en las pantallas operativas.

## Objetivo y alcance

Permitir revisar la apariencia y el comportamiento del inventario en condiciones normales y excepcionales, antes de integrar el diseño en Next.js. Esta entrega amplía el prototipo independiente iniciado en las fases 1 y 2. La integración de componentes y datos corresponde a las fases 3 y 4 del plan acordado.

Abrir http://127.0.0.1:4317 y desplegar **Revisar estados del diseño**. Si el servidor está detenido:

```powershell
node docs/design/serve.mjs
```

Los seis escenarios usan datos ficticios, sin red, autenticación, escritura de movimientos ni persistencia. La fecha de referencia continúa siendo el 17 de octubre de 2026. Los estados de carga y error son simulaciones explícitas; no representan disponibilidad real de servicios.

## Escenarios disponibles

| Escenario | Qué permite evaluar | Resultado comprobado |
| --- | --- | --- |
| Inventario habitual | Comparación de cantidades y unidades, alertas, búsqueda y detalle | Se conservan las seis presentaciones del primer prototipo. |
| Lotes con vencimientos distintos | Un medicamento con varias situaciones de vencimiento | Clonazepam tiene tres lotes: 80, 180 y 170 tabletas. Conserva 430 tabletas y aparece tanto en vencidos como en próximos a vencer. Los indicadores muestran dos medicamentos en cada grupo, sin sumar grupos como categorías excluyentes. |
| Datos incompletos y casos límite | Falta de fecha, falta de saldo, nombres/códigos largos y límites de los indicadores | Morfina muestra fecha no registrada; Diazepam, cero existencias; Midazolam, cantidad igual al mínimo y vencimiento a 30 días; Tramadol, vencimiento hoy. |
| Catálogo vacío | Inicio sin medicamentos, diferente de una búsqueda sin coincidencias | Indicadores en cero, aviso específico y acción para restaurar el catálogo DEMO. |
| Carga del inventario | Reserva de espacio y ausencia de datos confirmados | Esqueletos estáticos, cifras «—», búsqueda y movimiento deshabilitados. No se muestran alertas antiguas. |
| Error de consulta | Mensaje claro y recuperación de la vista | Cifras «—», mensaje de error simulado y reintento que restablece el inventario DEMO. No se confunde fallo con existencia cero. |

## Decisiones de diseño verificadas

- La cantidad se mantiene como **existencia registrada**, sin afirmar aptitud de dispensación.
- Las alertas de fecha se calculan por lotes con saldo positivo dentro del prototipo; un lote agotado no genera una alerta de vencimiento.
- Un mismo medicamento puede estar en los filtros de vencidos y próximos a vencer. La fila informa que existen ambos estados y el detalle identifica los lotes.
- Una fecha ausente no se presenta como vigente ni como vencida; se muestra un aviso de información pendiente. El filtro «Sin alertas de stock o fecha» excluye esos casos.
- Un medicamento sin lotes con saldo muestra «Sin lotes con saldo»; su detalle muestra cero lotes con existencia.
- La cantidad igual al mínimo se presenta como «En el mínimo». Se mantiene la comparación estricta `< mínimo` del prototipo para stock bajo.
- Los vencimientos del día de referencia y a 30 días se muestran respectivamente como «Vence hoy» y «Vence en 30 días». Son definiciones ilustrativas del prototipo, no una modificación de políticas clínicas de producción.
- Los nombres y códigos extensos se ajustan a varias líneas; no se recortan datos necesarios para identificar el medicamento.
- El panel de escenarios es una herramienta de revisión del prototipo. No se propone incorporarlo al flujo operativo de producción.

## Validación realizada

1. `node --check docs/design/prototype/prototype.js`: sin errores de sintaxis.
2. `npm run lint`: código 0, sin errores ni advertencias.
3. Navegador integrado Chromium: se recorrieron los seis escenarios, cambio de escenario, recuperación del error, restauración del catálogo y búsqueda sin coincidencias.
4. Escenario de datos incompletos en 320, 390, 768, 1024 y 1440 px: sin desplazamiento horizontal de la página, controles fuera del ancho disponible ni desbordamiento de celdas de tabla visibles.
5. Diálogo con nombre extenso y fecha ausente en 320 px: ancho interior y ancho desplazable iguales, sin desbordamiento horizontal. Escape permite volver al inventario.
6. Tema oscuro en móvil con datos incompletos: aviso de fecha pendiente visible, sin desbordamiento horizontal.
7. Detalle de Clonazepam con lotes mixtos: se verificaron los tres lotes y sus cantidades/fechas. Detalle de Diazepam sin saldo: cero lotes con existencia.
8. Filtro sin alertas en el escenario incompleto: solo Clonazepam. Se excluyeron el medicamento sin fecha, el medicamento sin saldo y aquellos con alertas de fecha.
9. Búsqueda sin coincidencias: se muestra el estado de búsqueda vacía y se mantiene oculto el estado de catálogo vacío.
10. Registros de consola capturados al finalizar: sin errores ni advertencias.

Se conservaron los tokens de color previamente revisados; el nuevo aviso de información pendiente usa la pareja de advertencia existente. No se declara una auditoría completa de accesibilidad. Siguen pendientes lectores de pantalla, zoom manual al 200 %, navegadores adicionales, dispositivos físicos y evaluación con operadores.

## Evidencia visual

- [Escritorio, escenario con lotes mixtos](previews/phase2-desktop.png)
- [Detalle de los tres lotes](previews/phase2-lots.png)
- [Estado de carga](previews/phase2-loading.png)
- [Estado de error](previews/phase2-error.png)
- [Móvil, datos incompletos](previews/phase2-mobile.png)
- [Móvil oscuro, datos incompletos](previews/phase2-mobile-dark.png)

## Límite de esta entrega y continuación

Los cambios se limitan a `docs/design` y sus referencias en el README. La aplicación operativa, Firebase, los permisos, las reglas, la auditoría y el historial permanecen fuera de este hito. No se ejecutó el build ni la suite funcional de Next.js: no se modificaron esos flujos y no se infieren sus resultados del lint. No se hizo commit, push ni despliegue.

La fase 3 deberá trasladar la base visual a componentes de la aplicación y consolidar estilos; la fase 4 conectará el inventario con el modelo existente. Se deberá verificar equivalencia de reglas, fechas y lotes en esa integración, sin asumir que la lógica ilustrativa de este prototipo reemplaza la lógica de producción.
