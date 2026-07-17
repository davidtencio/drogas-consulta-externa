# Protocolo de validación con farmacéuticos

Objetivo: cerrar la validación humana de ISO 9241-210 sin exponer datos reales. Las sesiones deben ejecutarse exclusivamente en modo demostración.

## Participantes

- 5 a 8 profesionales que representen farmacia de consulta externa.
- Incluir al menos una persona que use ampliación, alto contraste o navegación por teclado cuando sea posible.
- Moderador distinto de la persona que implementó la interfaz.

## Tareas observadas

1. Identificar un medicamento con stock bajo y explicar su estado.
2. Registrar un ingreso y verificar responsable, cantidad y resultado.
3. Intentar un egreso mayor al disponible y explicar el mensaje de recuperación.
4. Confirmar un conteo físico sin modificar existencias.
5. Encontrar un movimiento por medicamento y fecha.
6. Dar de baja un registro, cancelar una vez y completar la acción en el segundo intento.
7. Repetir una tarea usando únicamente teclado.
8. Cambiar de tema y aumentar el zoom del navegador al 200 %.

## Métricas y criterios de aceptación

| Métrica | Criterio |
|---|---:|
| Finalización sin ayuda | ≥ 90 % de las tareas |
| Errores operativos no recuperados | 0 |
| Tiempo mediano: movimiento | ≤ 60 segundos |
| Tiempo mediano: conteo | ≤ 45 segundos |
| Éxito solo con teclado | 100 % |
| SUS (System Usability Scale) | ≥ 80/100 |

Registrar por tarea: éxito, tiempo, errores, ayudas, ruta tomada y comentario textual. No registrar datos de pacientes, prescripciones reales ni credenciales.

## Regla de decisión

- Hallazgo crítico: riesgo de cambiar existencias o atribuir la acción al responsable incorrecto. Bloquea producción.
- Hallazgo alto: impide completar una tarea principal con teclado o asistencia. Bloquea producción.
- Hallazgo medio/bajo: se incorpora al backlog priorizado y se valida en la siguiente ronda.

La fase humana se considera cerrada solo con acta de resultados, severidades, responsables y fecha de reevaluación.

