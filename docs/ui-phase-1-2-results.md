# Resultados de implementación — Fases 1 y 2

Fecha: 17 de julio de 2026

## Fase 1 — Base accesible y responsive

- Indicador global `:focus-visible` con contraste y separación.
- Enlace “Saltar al contenido principal”.
- Navegación activa expuesta mediante `aria-current="page"`.
- Tamaños táctiles elevados a 44×44 px en móvil y controles críticos.
- Tipografía operativa mínima elevada, especialmente badges y metadatos.
- Barras de existencia convertidas a `progressbar` con nombre y valor accesibles.
- Tabla de movimientos transformada en tarjetas etiquetadas en móvil.
- Soporte para `prefers-reduced-motion`.

## Fase 2 — Diálogos, errores y prevención

- Nuevo `AccessibleDialog` reutilizable con `role="dialog"`, `aria-modal`, título y descripción asociados.
- Foco inicial explícito, ciclo de Tab, cierre con Escape y restauración al disparador.
- Confirmación nativa de baja sustituida por diálogo contextual; “Cancelar” recibe el foco inicial.
- Errores de guardado mostrados dentro del formulario con `role="alert"` y asociación mediante `aria-describedby`.
- Errores críticos globales persistentes hasta descarte manual.
- Campos numéricos de inventario restringidos a pasos enteros.

## Validación

| Comprobación | Resultado |
|---|---:|
| Vitest | 198/198 |
| Archivos de pruebas | 19/19 |
| ESLint | Correcto |
| Build Next.js | Correcto |
| Demo 320 px | Sin desbordamiento horizontal; 1 de 44 controles por debajo de 44×44 px |
| Tabla móvil | 3 filas renderizadas como tarjetas; cabecera tabular oculta visualmente |
| Diálogo de baja | Semántica modal correcta; foco inicial en Cancelar |
| Escape/restauración | Cierra el diálogo y devuelve foco a “Dar de baja” |

El único aviso de build continúa siendo el preexistente de Next.js sobre métricas fallback para Google Sans; no bloquea la compilación.

## Revisión React

- Hooks declarados incondicionalmente y efectos con limpieza de temporizadores/eventos.
- Estado de diálogo y errores colocado en el componente que coordina las operaciones.
- Elementos interactivos nativos y claves estables.
- Componentes nuevos separados por responsabilidad y con props tipadas.
