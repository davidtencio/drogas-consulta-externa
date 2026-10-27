# Prueba de aceptación en PC

Estado: pendiente de ejecución por el usuario. Esta hoja no contiene resultados humanos ni tiempos medidos.

La primera revisión acordada es en tu PC. Abre la [vista DEMO local](http://127.0.0.1:3000) en el navegador que usas habitualmente. Debe aparecer **Modo demostración**. Los medicamentos, responsables, lotes y prescripciones son ficticios. No introduzcas datos de pacientes ni credenciales reales. Recargar restablece los datos de la demostración.

## Sesión

| Dato | Resultado por registrar |
| --- | --- |
| Persona evaluadora | Usuario solicitante |
| Fecha y hora | Pendiente |
| Sistema operativo y navegador/versión | PC; detalles pendientes |
| Resolución y zoom habitual | Pendiente |
| Ayudas utilizadas: teclado, ampliación o lector | Pendiente |

## Tareas

| N.º | Qué hacer | Qué comprobar | Resultado / observación |
| --- | --- | --- | --- |
| 1 | Busca Clonazepam y abre su detalle. | Distingues existencia registrada, lote vencido y lote por vencer; ninguna etiqueta afirma que el producto es apto para dispensar. | Pendiente |
| 2 | Abre un egreso de Metformina; intenta una cantidad superior a la registrada. Después corrige a 1, elige un responsable ficticio y confirma. | El primer intento se rechaza sin perder los campos. Cantidad recibe el foco. El intento corregido reduce el saldo en 1 y aparece en Movimientos. | Pendiente |
| 3 | Registra un ingreso de Metformina con dos lotes ficticios distintos, cantidades 2 y 3 y fechas futuras. | El ingreso suma 5, conserva ambos lotes y atribuye la operación al responsable elegido. | Pendiente |
| 4 | Abre Toma de inventario y confirma solo un medicamento con un responsable DEMO. | Se registra el conteo y se limpia la selección; el saldo no cambia. | Pendiente |
| 5 | En Movimientos, busca una referencia ficticia que acabes de usar y exporta CSV. | Encuentras el movimiento; el archivo respeta los filtros. | Pendiente |
| 6 | En Configuración, crea un medicamento ficticio con existencia 0. Cancela una baja, luego complétala y reactívalo filtrando por Inactivos. | Cancelar conserva el registro activo. La baja permite reactivación y conserva su identidad. | Pendiente |
| 7 | Repite búsqueda y apertura/cierre de un detalle con teclado. Prueba `/`, Tab, Shift+Tab, Enter y Escape. | El foco se ve, permanece dentro del diálogo y regresa al botón de origen al cerrar. | Pendiente |
| 8 | Cambia de tema y usa zoom del navegador al 200 %. Luego restablece el zoom. | Puedes leer, desplazarte y completar una tarea; los botones y mensajes no se tapan. | Pendiente |

Si observas un problema, registra pantalla, acción, resultado esperado y lo que ocurrió. Basta describirlo; no hacen falta datos reales. Marca cada tarea como **Completada sin ayuda**, **Completada con ayuda** o **No completada**. Los tiempos solo se añaden si se cronometran.

## Decisión de la revisión

- Problemas que impiden operar o comprender cantidades/responsables: pendientes de revisar.
- Correcciones necesarias y responsable: pendientes.
- Resultado: **sin aceptar todavía**.
- Fecha de repetición tras corregir: pendiente.

Puedes responder en el chat con los números de las tareas probadas y tus observaciones. La revisión individual en PC es la primera aceptación operativa; el [protocolo institucional ampliado](../usability-validation-protocol.md) queda disponible para sesiones con más participantes y tecnologías de apoyo. No se han medido éxito humano, SUS ni tiempos de uso.
