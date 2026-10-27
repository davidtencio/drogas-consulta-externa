# Rediseño profesional — fases 1 y 2

Fecha: 17 de octubre de 2026. Estado: prototipo de fases 1–2 conservado; [base visual de fase 3](phase-3.md), [inventario de fase 4](phase-4.md) y [flujos restantes de fase 5](phase-5.md) integrados localmente, sin publicar.

La [fase 6](phase-6.md) completa la validación técnica local y prepara la entrega autenticada. El 27 de octubre de 2026 el usuario autorizó su publicación en producción; véase la [preparación de publicación y reversión](release-checklist.md). La [hoja de aceptación en PC](acceptance-pc.md) sigue sin resultados humanos registrados. La vista DEMO puede iniciarse en http://127.0.0.1:3000.

La [entrega ampliada de la fase 2](phase-2.md) añade escenarios seleccionables de carga, error, catálogo vacío, lotes mixtos y datos incompletos. La vista habitual y el servidor local conservan la misma dirección.

## Alcance de este primer hito

Proponer y probar la nueva experiencia del inventario en escritorio y móvil. El prototipo es independiente de Next.js, no importa Firebase, no solicita credenciales y no modifica datos. Sus medicamentos, códigos, cantidades, lotes, responsables y certificaciones son ficticios. La fecha de referencia es fija: 2026-10-17, para que los escenarios sean reproducibles.

Ejecutar desde la raíz del repositorio:

```powershell
node docs/design/serve.mjs
```

Abrir http://127.0.0.1:4317. También se puede abrir `prototype/index.html` directamente. No requiere instalar dependencias.

## Diagnóstico basado en el código y la captura

| Hallazgo | Evidencia | Decisión propuesta |
| --- | --- | --- |
| Estilos acumulados y reglas que se sobrescriben | `app/globals.css`: estilos base, rediseño oscuro, correcciones por tema y sucesivas capas de adaptación | Construir una base de tokens y componentes antes de integrar; sustituir reglas al migrar cada componente en lugar de seguir agregando excepciones. |
| Preferencia inicial por oscuro incluso sin elección explícita | Selector `:root:not([data-theme=light])` en `app/globals.css` | Tema claro inicial para la propuesta; oscuro equivalente y selección explícita. Conservar la preferencia existente al integrar. |
| Diferencia de tipografía entre captura y código | La captura presenta remates; `app/layout.tsx` configura Google Sans mediante `next/font` | El prototipo utiliza una pila sans local. En la integración, verificar fuente calculada, variables heredadas y versión desplegada. La causa de la diferencia aún no está confirmada. |
| Tarjetas altas para una tarea de comparación | `MedicineCard.tsx` reúne identificación, stock, barra, lotes, certificación y tres acciones | Tabla comparativa en escritorio, tarjetas compactas en móvil y detalle de lotes en diálogo. |
| Mensajes que confunden cantidad y vencimiento | `MedicineCard.tsx` puede mostrar “Disponible” junto con “Vencido” | Etiquetar la cantidad como “Existencia registrada”; vencimiento en columna propia. No inferir aptitud de dispensación ni modificar las reglas clínicas. |
| Métricas poco específicas | `StatsBar.tsx` combina vencidos y próximos a vencer; `totalStock` suma cantidades del catálogo | Separar indicadores por medicamento: catálogo, stock bajo, con lotes vencidos y con lotes próximos a vencer. Evitar un gran total que mezcle unidades distintas. Confirmar estas definiciones antes de integrar. |
| Certificación presentada como un icono | `MedicineCard.tsx` revela información al abrir un diálogo | Mantener la acción accesible e identificar “Última toma de inventario”, fecha y responsable. No convertir una toma histórica en garantía actual del stock. |

La revisión de código es una inspección de estructura y flujos; no equivale a una evaluación de usabilidad con operadores ni a una auditoría completa de accesibilidad.

## Mapa de pantallas y tareas

| Pantalla | Tarea principal | Información prioritaria | Continuidad propuesta |
| --- | --- | --- | --- |
| Inventario | Localizar y revisar un medicamento | Nombre, concentración, cantidad y unidad, stock mínimo y vencimiento | Buscar → filtrar → revisar lotes → iniciar movimiento. Prototipado en este hito. |
| Movimientos | Consultar trazabilidad | Tipo, fecha, medicamento, cantidad, responsable, referencia y observación | Mantener filtros, paginación y acceso desde medicamento; diseño detallado en fase 5. |
| Toma de inventario | Registrar evidencia de conteo | Saldo del sistema, confirmaciones, responsable, observación y resultado | Conservar la distinción actual: registrar conteo no ajusta existencias. Diseño detallado en fase 5. |
| Configuración | Gestionar catálogo y personal autorizado | Estado activo, datos de identificación y acciones administrativas | Mantener acceso por rol y baja/reactivación; diseño detallado en fase 5. |
| Inicio de sesión y estados globales | Entrar y comprender el estado de la sesión | Identidad, acceso, conectividad y errores | Aplicar la misma base visual durante la integración. |

## Dirección visual

- Fondo neutro `#f4f6f8`, superficie blanca y texto azul pizarra `#172b3a`.
- Verde petróleo `#12695b` para acción principal y sección seleccionada.
- Rojo y ámbar para vencimiento y atención, siempre con texto y símbolo.
- Tipografía sans local, base de 14 px en escritorio; entradas de 16 px en móvil. Cifras tabulares, título de 28 px y etiquetas legibles.
- Escala de espacios de 4 px; controles de al menos 44 px; radios de 8–12 px y sombras limitadas al diálogo.
- Un botón principal por cabecera, exportación secundaria y detalle mediante botón explícito.
- Navegación lateral compacta en escritorio; navegación inferior en móvil.

## Comportamientos incluidos

1. Búsqueda por nombre, concentración, código y lote, sin distinción de mayúsculas ni acentos.
2. Filtros de stock y vencimiento combinables con la búsqueda; contadores calculados sobre el catálogo DEMO completo.
3. Orden por nombre, existencia o vencimiento más cercano.
4. Resultados vacíos con acción para limpiar filtros.
5. Detalle accesible de lotes y última toma; cierre con Escape y retorno de foco mediante diálogo nativo.
6. Alternancia claro/oscuro, sin persistir preferencias en el navegador.
7. Vista previa de movimiento identificada como demostración, sin registro ni modificación de cantidades.
8. Navegación secundaria explicativa: las pantallas restantes muestran el alcance previsto y no simulan operaciones completas.
9. Selector «Revisar estados del diseño» para comparar seis escenarios de revisión. Incluye fechas ausentes, lotes sin saldo, textos largos y límites de vencimiento.

No se añaden acciones operativas falsas: el prototipo no guarda movimientos, no autentica, no exporta archivos y no afirma conexión o sincronización con producción.

## Criterios de revisión

- Comparar nombre, concentración, existencia y vencimiento sin abrir cada medicamento.
- Ver todas las acciones esenciales sin hover.
- Distinguir stock bajo, vencido y próximo a vencer sin depender solo del color.
- Mantener búsqueda y filtros utilizables desde 320 px; sin desplazamiento horizontal de la página.
- Navegar por teclado, ver el foco y cerrar diálogos con Escape.
- Revisar contraste de los pares usados realmente y estados claro/oscuro; las pruebas de tokens actuales no certifican por sí solas el nuevo diseño.
- Usar los mismos datos y definiciones entre tabla y tarjetas.
- Validar con operadores antes de considerar finalizada la fase 2. El prototipo sigue pendiente de revisión del usuario.

## Continuación por fases

| Fase | Estado | Resultado esperado |
| --- | --- | --- |
| 1. Diagnóstico y estructura | Diagnóstico inicial documentado | Incorporar observaciones sobre tareas y prioridades. |
| 2. Prototipo visual | Ampliado y verificado técnicamente; revisión con usuarios pendiente | Revisar escritorio, móvil y seis escenarios; ver `phase-2.md`. |
| 3. Base e interfaz general | Integrada localmente y validada; sin desplegar | Tokens, controles, navegación y encabezados compartidos; ver `phase-3.md`. |
| 4. Inventario operativo | Integrado y verificado localmente; sin desplegar | Tabla, tarjetas compactas, filtros, detalle de lotes y exportación de la vista; ver `phase-4.md`. |
| 5. Flujos restantes | Integrados y verificados localmente; sin desplegar | Movimientos, conteos, configuración, formularios y acceso; ver `phase-5.md`. |
| 6. Validación y publicación | Parte técnica local completada; aceptación en PC pendiente; sin publicar | Pruebas funcionales, accesibilidad, reglas en emulador y compilación autenticada; ver `phase-6.md`, `acceptance-pc.md` y `release-checklist.md`. |

La integración debe preservar historial, baja/reactivación, roles, trazabilidad, lectura de lotes y semántica de conteos. Este hito no requiere cambios de Firestore ni despliegue. El estado previo del repositorio estaba limpio al comenzar.

## Verificación de este hito

Ver `validation.md` para las comprobaciones realizadas y sus límites.
