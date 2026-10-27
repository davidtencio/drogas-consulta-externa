# Fase 5 — formularios y pantallas restantes

Fecha: 17 de octubre de 2026. Integración local del rediseño gráfico; sin commit, push ni despliegue. Esta numeración corresponde al plan de `docs/design/README.md`, no a las fases anteriores del piloto documentadas en `docs/ui-phase-5-results.md`.

## Resultado

- **Movimientos:** filtros alineados, resumen por número de operaciones, tabla de escritorio y filas adaptadas a móvil. Cantidades con unidad cuando el catálogo permite identificarla; notas mediante acción con texto. Se explicita el límite de 200 registros recientes y que los filtros de fechas usan la fecha UTC del registro. Se conserva la consulta completa para el CSV con los mismos filtros y orden; se añade estado de preparación y error recuperable.
- **Configuración:** búsqueda por nombre, código, correo o código profesional, sin distinción de acentos; filtro de activos e inactivos. Acciones agrupadas por registro, estados legibles sin reducir la opacidad de todo el registro y conservación de baja/reactivación. La bitácora mantiene su contenido y no añade acciones de edición o eliminación.
- **Ingreso y egreso:** secciones para medicamento/operación, lotes recibidos y referencia/responsable. La existencia mostrada conserva su unidad. Cada lote tiene su propio grupo de campos; quitar una fila conserva los datos de las demás. Acciones consistentes de cancelar y guardar, con estado de envío y errores asociados a campos.
- **Medicamentos y farmacéuticos:** identificación y control de existencias separados en el formulario de medicamento; mismos nombres de campos y llamadas existentes. Alta de farmacéutico con campos accesibles y errores de correo/código profesional asociados a sus entradas.
- **Toma de inventario:** preparación de la revisión, responsable, observación, lista de coincidencias verificadas, unidades y progreso explícito. Se explica que «Confirmar todos» incluye los registros ocultos por la búsqueda. Tras guardar se limpian las selecciones y la observación visible. Confirmar un saldo sigue registrando evidencia sin ajustar existencias.
- **Acceso:** pantalla con identidad de la aplicación, propósito, tarjeta de inicio con Google, selección de tema y explicación del rol requerido. Conserva el proveedor y el flujo de autenticación; informa fallos mediante un aviso accesible y permite reintentar.

## Consolidación visual y de estados

`app/styles/workflows.css` reúne los estilos operativos que antes estaban repartidos entre `components.css`, `observations.css` y `lots.css`. Se retiran los dos últimos archivos y sus importaciones. Se conservan en `components.css` los estilos de compatibilidad de las tarjetas anteriores, avisos y esqueletos.

Los diálogos amplios se ajustan a la altura disponible y permiten desplazamiento interno. La revisión en 320 px detectó que la navegación inferior podía cubrir las acciones: la capa de los diálogos se sitúa por encima de esa navegación. Se verifica el destino visible de los botones y su cierre después de la corrección.

Las lecturas de personal, movimientos y bitácora distinguen carga, vacío y error. Un reintento renueva las suscripciones existentes; no crea nuevas consultas de negocio. Los indicadores de Movimientos cuentan operaciones en lugar de sumar cantidades de presentaciones diferentes. Las funciones de resumen y reglas de dominio existentes no cambian.

La exportación de Movimientos tenía una consulta directa a Firestore incluso en DEMO. En DEMO utiliza ahora el almacén ficticio en memoria; el recorrido autenticado conserva la consulta completa existente.

## Verificación

| Comprobación | Evidencia |
| --- | --- |
| Suite automatizada | 34 archivos y 278 pruebas aprobadas en la última ejecución completa. |
| Lint | `npm run lint`, sin errores. |
| Compilación | `npm run build` aprobado tanto con DEMO deshabilitado como habilitado; la última compilación y el servidor local usan DEMO. |
| Accesibilidad automática | Axe sin infracciones en acceso, formularios de ingreso/medicamento/farmacéutico, confirmación de saldo y configuración. Las pruebas de tokens conservan contraste AA en sus pares evaluados. |
| Ingreso DEMO | Metformina: 320 → 325; dos lotes nuevos de 2 y 3, además del saldo inicial de 320. |
| Egreso DEMO | Metformina: 325 → 324; referencia `DEMO-FASE5-EGRESO` y observación visibles en el historial, asignación de 1 al lote correspondiente. |
| CSV DEMO | Descarga real `movimientos_2026-10-17.csv`, encabezado y una sola fila con el egreso filtrado y su observación. Prueba automatizada comprueba que no se llama a Firestore. |
| Configuración DEMO | Alta con stock 0, edición de mínimo a 10, baja, búsqueda entre inactivos y reactivación. Alta de un responsable ficticio. |
| Conteo DEMO | Un saldo confirmado de Metformina, observación registrada, progreso restablecido y stock 324 conservado. Detalle posterior muestra el conteo histórico y los lotes 319 + 2 + 3. |
| Adaptación | Configuración, Movimientos y Toma de inventario revisados entre 320, 390, 768, 1024 y 1440 px. Sin desbordamiento horizontal de página ni controles fuera del ancho. |

Las comprobaciones del navegador se realizaron contra `http://127.0.0.1:3000` con una compilación optimizada. Se verificó también la pantalla de acceso sin autenticarse, con DEMO deshabilitado temporalmente solo en el proceso de compilación. No se modificaron archivos de entorno ni cuentas reales.

## Límites y continuación

No se probaron escrituras contra Firestore real, permisos efectivos con Emulator Suite ni un inicio de sesión OAuth completo. Los fallos de suscripción y de autenticación se cubrieron con mocks; las comprobaciones de interfaz no sustituyen esas pruebas. No se modificaron reglas de Firestore, roles, transacciones de producción ni criterios de dispensación. Las operaciones de navegador usaron exclusivamente datos ficticios en memoria.

Queda la **fase 6**: revisión con operadores, pruebas completas en un entorno de validación autorizado, dispositivos reales y tecnologías de apoyo; consolidación de hallazgos y preparación de la publicación. La aprobación automática de axe y la simulación de tamaños no certifican por sí solas accesibilidad o usabilidad completas.

## Capturas

- [Movimientos en escritorio](previews/phase5-movements-desktop.png).
- [Formulario de egreso](previews/phase5-form-out.png).
- [Ingreso con varios lotes](previews/phase5-form-lots.png).
- [Configuración en escritorio](previews/phase5-settings-desktop.png).
- [Configuración en móvil oscuro](previews/phase5-settings-mobile-dark.png).
- [Movimientos en móvil oscuro](previews/phase5-movements-mobile-dark.png).
- [Toma de inventario](previews/phase5-count-desktop.png).
- [Acceso en escritorio](previews/phase5-login-desktop.png).
- [Acceso en móvil oscuro](previews/phase5-login-mobile-dark.png).

Las capturas operativas corresponden a datos DEMO, incluidas las cantidades y los responsables. Las altas y movimientos de prueba se descartan al recargar la sesión.
