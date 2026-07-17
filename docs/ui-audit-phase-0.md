# Auditoría UI — Fase 0

Fecha: 17 de julio de 2026  
Proyecto: Control de Drogas Consulta Externa  
Objetivo: establecer la línea base previa a la implementación de mejoras WCAG 2.2 AA e ISO 9241-210.

## Alcance y metodología

- Revisión estática de `app/page.tsx`, `app/globals.css` y componentes interactivos.
- Revisión de semántica HTML y atributos ARIA.
- Revisión de navegación por teclado inferida desde controles y estilos.
- Revisión de tamaños tipográficos, objetivos táctiles, estados y diseño responsive.
- Ejecución de pruebas, ESLint y build de producción.
- Revisión renderizada en navegador local mediante el modo demostración.
- Auditoría automática Lighthouse Accessibility y comprobaciones de reflujo/tamaño de objetivos.

La inspección inicial autenticada quedó bloqueada porque la sesión de Firebase no se resolvió en el navegador aislado. Después se incorporó un modo demostración sin Firebase, que permitió verificar el dashboard completo con seis medicamentos, dos farmacéuticos, movimientos, alertas de stock y vencimiento.

## Línea base técnica

| Comprobación | Resultado |
|---|---:|
| Pruebas Vitest | 195/195 aprobadas |
| Archivos de pruebas | 18/18 aprobados |
| ESLint | Correcto |
| Build Next.js | Correcto |
| Rutas generadas | `/`, `/arqueo`, `/manifest.webmanifest` |
| Lighthouse Accessibility | 100/100 en modo demostración; 0 reglas fallidas |
| Motor axe | Cubierto por las reglas de accesibilidad de Lighthouse; la inyección directa fue incompatible con el contexto aislado del navegador |
| Render completo sin autenticación | Correcto en modo demostración |
| Reflujo equivalente a 200 % | Correcto, sin desplazamiento horizontal a 720×450 CSS px |
| Responsive renderizado | Correcto a 320 px, 768 px y 1440 px; sin desplazamiento horizontal |

Lighthouse generó un informe válido y completo. En Windows, el comando terminó con `EPERM` al intentar borrar su directorio temporal después de guardar el resultado; esta incidencia de limpieza no afectó la ejecución, que no contiene `runtimeError`.

## Evidencia responsive y de accesibilidad

| Escenario | Viewport | Ancho del documento | Desbordamiento horizontal | Controles menores de 44×44 px |
|---|---:|---:|---:|---:|
| Escritorio | 1440×900 | 1425 px | No | 22/27 |
| Tablet | 768×1024 | 753 px | No | 3/27 |
| Móvil | 320×800 | 305 px | No | 21/27 |
| Reflujo 200 % (equivalente) | 720×450 | 705 px | No | No medido |

El escenario de 200 % se ejecutó reduciendo a la mitad el viewport CSS de escritorio, una aproximación reproducible al espacio disponible tras ampliar el contenido. Debe complementarse con una comprobación manual de zoom nativo en los navegadores objetivo antes de producción.

Capturas: [escritorio](audit-phase-0/desktop-1440.png), [tablet](audit-phase-0/tablet-768.png), [móvil](audit-phase-0/mobile-320.png) y [reflujo 200 %](audit-phase-0/zoom-200-proxy.png). Informe automático: [Lighthouse JSON](audit-phase-0/lighthouse-accessibility.json).

El build muestra una advertencia no bloqueante: Next.js no encuentra métricas de ajuste para la fuente Google Sans y omite generar la fuente fallback ajustada.

## Escala de severidad

- **Crítica:** puede provocar una operación incorrecta o bloquear por completo a un grupo de usuarios.
- **Alta:** incumplimiento probable de WCAG AA o barrera importante para teclado/lector de pantalla.
- **Media:** afecta comprensión, eficiencia o uso táctil, pero existe una alternativa.
- **Baja:** mejora de consistencia o refinamiento que no bloquea la tarea.

## Matriz de hallazgos

| ID | Severidad | Hallazgo | Evidencia actual | Recomendación | Criterio relacionado |
|---|---|---|---|---|---|
| UI-001 | Alta | No existe un estilo global `:focus-visible` para botones y enlaces. | `globals.css` define `:hover`; el foco solo está estilizado en algunos campos. | Añadir un indicador global de 3 px con `outline-offset`, verificable en ambos temas. | WCAG 2.4.7, 2.4.11 y 2.4.13 |
| UI-002 | Alta | Los modales no tienen semántica de diálogo. | `Modals.tsx` y `CountModal.tsx` usan `<div className="modal">` sin `role="dialog"`, `aria-modal` ni título asociado. | Crear un componente `AccessibleDialog` reutilizable. | WCAG 4.1.2; WAI-ARIA Dialog Pattern |
| UI-003 | Alta | No se gestiona el foco del modal. | No hay foco inicial, trampa de Tab, cierre con Escape ni restauración al disparador. | Implementar el ciclo completo de foco y establecer “Cancelar” como foco inicial en acciones de riesgo. | WCAG 2.1.1, 2.4.3 |
| UI-004 | Alta | Existen textos operativos inferiores a 12 px. | Badges de 8 px; metadatos de 8–10.8 px; subtítulos de KPI de 9 px. | Elevar badges y metadatos a 11–12 px y contenido operativo a 14–16 px. | WCAG 1.4.4; ergonomía y legibilidad |
| UI-005 | Alta | Muchos objetivos táctiles quedan por debajo de 44×44 px. | Medición del demo: 21/27 controles en 320 px y 3/27 en 768 px; el botón “Descartar aviso” mide 22×24 px. | Mínimo técnico 24×24 px; objetivo clínico recomendado 40–44 px. | WCAG 2.5.8 |
| UI-006 | Alta | No existe evidencia automatizada de contraste en ambos temas. | Los tokens `--muted` y `--faint` se usan sobre varias superficies y gradientes. | Medir cada estado y asegurar 4.5:1 para texto normal y 3:1 para componentes/foco. | WCAG 1.4.3 y 1.4.11 |
| UI-007 | Media | La navegación activa no se expone semánticamente. | Sidebar cambia clase visual `active`, sin `aria-current` ni patrón de pestañas. | Añadir `aria-current="page"` o semántica de tab según el comportamiento final. | WCAG 1.3.1 y 4.1.2 |
| UI-008 | Media | No hay enlace para saltar al contenido. | El primer recorrido de teclado comienza en la navegación lateral. | Añadir `Saltar al contenido` y un destino estable en el contenido principal. | WCAG 2.4.1 |
| UI-009 | Media | La barra de existencias depende del color y no tiene nombre accesible. | `MedicineCard` renderiza `.bar > i` sin texto porcentual o semántica de progreso. | Mostrar “n % del mínimo” y usar `role="progressbar"` con valores y etiqueta. | WCAG 1.4.1 y 4.1.2 |
| UI-010 | Media | La tabla móvil depende del desplazamiento horizontal. | `.table-wrap{overflow:auto}` es la única adaptación estructural de movimientos. | Crear presentación por tarjetas en móvil o columnas prioritarias con expansión. | WCAG 1.4.10 |
| UI-011 | Media | La baja de registros usa confirmación nativa genérica. | `window.confirm` se invoca desde `page.tsx`. | Sustituir por diálogo contextual con nombre, consecuencia, cancelar y recuperación. | WCAG 3.3.4; prevención de errores |
| UI-012 | Media | Los errores de formulario no se asocian al campo. | La mayoría de errores terminan en un toast global. | Usar `aria-invalid`, `aria-describedby`, mensaje junto al campo y foco en el primer error. | WCAG 3.3.1 y 3.3.3 |
| UI-013 | Media | Los mensajes críticos desaparecen automáticamente. | `flash` elimina el toast después de cuatro segundos. | Mantener errores críticos hasta descarte; reservar `role="status"` para confirmaciones normales y `role="alert"` para errores urgentes. | WCAG 4.1.3 |
| UI-014 | Media | No hay soporte explícito para movimiento reducido. | Existe una animación de conexión y transiciones sin bloque `prefers-reduced-motion`. | Desactivar animaciones no esenciales cuando el usuario lo solicite. | WCAG 2.3.3 |
| UI-015 | Baja | Las tres acciones por tarjeta compiten visualmente. | Ingreso, Egreso y Conteo tienen el mismo peso y proximidad. | Validar con farmacéuticos una acción primaria y un menú secundario. | ISO 9241-210 |
| UI-016 | Baja | No existen pruebas automáticas específicas de accesibilidad. | Hay pruebas funcionales con Testing Library, pero no `axe` ni Lighthouse CI. | Incorporar `jest-axe`/`axe-core`, pruebas de foco y Lighthouse CI después de corregir las brechas base. | Control de calidad WCAG |

## Aspectos positivos observados

- Todos los controles principales utilizan elementos HTML interactivos reales.
- La búsqueda y los filtros tienen nombres accesibles.
- El cambio de tema informa estado mediante `aria-pressed` y `aria-label`.
- Los estados de stock incluyen texto y no dependen únicamente del color.
- Los toasts normales ya utilizan `role="status"`.
- Las tablas usan elementos semánticos `table`, `thead`, `tbody`, `th` y `td`.
- Los formularios tienen etiquetas visibles.
- Existe cobertura funcional para tarjetas, movimientos, configuración, modales, arqueo, alertas y login.

## Priorización para la fase 1

1. `UI-001`: foco visible global.
2. `UI-004`: escala tipográfica mínima.
3. `UI-005`: tamaño táctil mínimo.
4. `UI-007`: estado semántico de navegación.
5. `UI-008`: enlace para saltar al contenido.
6. `UI-014`: movimiento reducido.
7. Preparar medición de contraste `UI-006` antes de modificar tokens.

Los modales (`UI-002` y `UI-003`) se mantienen como prioridad alta, pero corresponden a la fase 2 porque requieren gestión de foco y un componente compartido, no solo estilos globales.

## Criterios de salida de la fase 0

- [x] Inventario de pantallas y componentes interactivos.
- [x] Matriz de hallazgos con severidad y componente afectado.
- [x] Línea base de pruebas, lint y build.
- [x] Identificación de brechas de semántica, teclado, tipografía y responsive.
- [x] Auditoría Lighthouse/axe en modo demostración.
- [x] Dashboard renderizado con datos ficticios, sin Firebase.
- [x] Capturas a 320 px, 768 px, escritorio y reflujo equivalente a zoom de 200 %.
- [ ] Sesión de observación con farmacéuticos.

La fase 0 queda **técnicamente completada**: la evidencia de código, la línea base, la auditoría automática y la matriz responsive están documentadas. Solo permanece pendiente la actividad humana de observación con farmacéuticos, que requiere coordinación externa y no bloquea el inicio de la fase 1 técnica.

## Referencias

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WCAG 2.2 — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [WCAG 2.2 — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- [ISO 9241-210:2019](https://www.iso.org/standard/77520.html)
