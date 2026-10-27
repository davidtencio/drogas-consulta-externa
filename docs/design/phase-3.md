# Fase 3 — Base visual integrada en la aplicación

Fecha: 17 de octubre de 2026. Estado: implementada y validada localmente. No publicada.

## Resultado

La aplicación Next.js utiliza la base visual del prototipo: superficies neutras, verde petróleo, tipografía sans local, controles consistentes, navegación lateral en escritorio y navegación inferior en móvil. No es una captura del prototipo independiente: las vistas de esta fase pertenecen a la aplicación, ejecutada con datos de demostración.

El inventario conserva sus tarjetas, indicadores y reglas actuales. La tabla, los nuevos filtros y el detalle de lotes del prototipo se integrarán en la fase 4; la renovación detallada de formularios y pantallas operativas corresponde a la fase 5.

## Cambios de estructura y diseño

| Archivo o componente | Responsabilidad |
| --- | --- |
| `app/globals.css` | Entrada de estilos, compuesta por cinco importaciones. |
| `app/styles/tokens.css` | Fuente local, colores por tema, espacios, radios, tamaños, contraste de acciones y superficies. |
| `app/styles/base.css` | Reset, controles comunes, foco visible, enlace de salto y botones. |
| `app/styles/shell.css` | Navegación, perfil, encabezados, estructura del área de trabajo y adaptación a móvil. |
| `app/styles/feedback.css` | Avisos de vencimiento, conexión, demostración y piloto. |
| `app/styles/components.css` | Estilos de los componentes operativos existentes, conservados para su migración gradual en las fases 4–5. Colores y sombras se vinculan a los tokens. |
| `PageHeader` | Título, descripción, contexto y acción principal compartidos por las pestañas de la aplicación y la toma de inventario. |
| `WorkspaceHeader` | Identificación del área y rótulo de DEMO o piloto cuando corresponde. |
| `Sidebar` | Navegación y perfil adaptables; la visibilidad de Configuración sigue dependiendo del rol. La salida de sesión sigue disponible en móvil para sesiones reales. |

Se retiraron del archivo global las definiciones superpuestas de temas, estructura y botones. La fase 3 no pretende completar la consolidación interna de todos los componentes operativos: sus estilos permanecen separados, con su estructura funcional conservada.

## Tipografía y tema

- La fuente usa la pila local `Segoe UI`, fuentes del sistema, Roboto y Arial, con alternativa sans-serif. Se eliminó la carga de Google Sans desde `next/font`.
- En el código anterior, las variables de fuente declaradas en `:root` dependían de una variable asignada al `body`. Esa dependencia podía quedar sin resolver al calcularse en la raíz. La nueva pila no depende de esa herencia. No se inspeccionó el despliegue original para atribuirle definitivamente la captura antigua.
- Se verificó en el navegador la familia calculada, el fondo claro y la fuente de los controles.
- Sin preferencia guardada, la presentación inicial es clara. Una elección guardada de oscuro se respeta antes de pintar y permanece tras recargar.
- El script de inicialización conserva el nonce de la CSP. Las excepciones de hidratación se limitan al atributo de tema del elemento raíz y al nonce ocultado por el navegador; no se silencian discrepancias en los componentes operativos.
- Se normalizaron los espacios de la hora mostrada en la certificación: servidor y navegador producían distintos tipos de espacio en `a. m.`. No se cambió la fecha almacenada ni la lógica de certificación.

## Comprobaciones realizadas

| Comprobación | Evidencia |
| --- | --- |
| Suite completa | 27 archivos y 245 pruebas pasaron durante la integración. |
| Regresión tras los ajustes finales de componentes | 19 pruebas pasaron: toma de inventario, tarjeta de medicamento, selección de tema y contraste de los tokens. |
| Lint | `npm run lint`, código 0, sin errores ni advertencias. |
| Build | Build normal completado; las compilaciones posteriores para la revisión DEMO también completaron compilación, TypeScript y generación de rutas. El último cambio posterior al build solo añade comentarios y documentación. |
| Respuesta local | HTTP 200, rótulo DEMO y cabecera CSP presente, sin `unsafe-eval`. No se modificó `proxy.ts` ni se relajó la CSP. |
| Recorrido de datos DEMO | Egreso ficticio de una unidad de Clonazepam: saldo 96 → 95, confirmación de guardado y fila con referencia `DEMO-FASE-3` en Movimientos. La recarga restableció el saldo inicial de la memoria DEMO. |
| Navegación | Se revisaron Inventario, Movimientos, Configuración y la ruta de Toma de inventario. Esta última usa el encabezado común y muestra el aviso DEMO. |
| Adaptación | Se inspeccionaron las tres pestañas principales a 320, 390, 768, 1024 y 1440 px. Se corrigió un selector de Movimientos que quedaba recortado a 320 px y se verificó de nuevo. |
| Móvil | Navegación inferior, indicadores en dos columnas a 390 px y ausencia de desbordamiento horizontal de página. |
| Diálogo | Formulario de movimiento accesible en móvil, controles dentro del ancho disponible, foco inicial y cierre con Escape. |
| Persistencia del tema | Selección de oscuro, recarga y comprobación de `data-theme="dark"` y del botón para volver a claro. |
| Consola final | Sin errores ni advertencias capturados en la versión compilada de demostración. |

Durante la revisión con `next dev` apareció el aviso de React que solicita eval para herramientas de depuración. Se mantuvo la política de seguridad y se verificó la interfaz con `next build` + `next start`. No se añadió `unsafe-eval`.

La revisión de React mantuvo componentes de presentación pequeños, importaciones directas y la separación de la lógica operativa. No se incorporaron librerías de interfaz ni nuevas suscripciones o consultas.

## Capturas de la aplicación

- [Escritorio claro](previews/phase3-app-desktop.png)
- [Escritorio oscuro](previews/phase3-app-dark.png)
- [Móvil](previews/phase3-app-mobile.png)
- [Formulario móvil](previews/phase3-app-dialog.png)

## Reproducción local

La revisión de esta entrega está disponible en http://127.0.0.1:3000 mientras el servidor local siga activo. Para volver a generar exclusivamente la vista de demostración:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='1'
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

El indicador se pasó al proceso local; no se modificaron archivos `.env`. El resultado local de esta compilación es DEMO y no se debe usar como artefacto de un despliegue operativo. La configuración de producción debe compilarse con el modo DEMO desactivado, como indica el README.

## Límites

No hubo cambios en Firestore, las reglas, las colecciones, la autenticación, los roles, la auditoría, las prescripciones o el significado de los conteos. Las únicas operaciones de prueba se realizaron con el almacén ficticio en memoria. No se verificó la aplicación contra datos reales ni se hicieron pruebas de reglas en Emulator, porque esta entrega no modifica esas capas.

Las pruebas de contraste sobre tokens y las comprobaciones de teclado no constituyen una auditoría completa de accesibilidad. Siguen pendientes lectores de pantalla, dispositivos físicos, otros navegadores y revisión de usabilidad con operadores. No se hizo commit, push ni despliegue.
