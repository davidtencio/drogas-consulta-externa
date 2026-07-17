# Fase 5 — Preparación para piloto controlado

## Implementado

- Autorización por roles aplicada en UI y reglas de Firestore.
- Acceso administrativo restringido al catálogo, farmacéuticos y bitácora.
- Movimientos, auditorías e incidentes operativos inmutables.
- Identidad de la sesión registrada como actor de cada movimiento.
- Aviso visible de entorno piloto mediante variable de configuración.
- Límite de contención para errores inesperados con opción de recuperación.
- Guía de despliegue, prueba de humo, monitoreo, parada y reversión.

## Criterio de salida

La fase queda lista en código cuando pruebas, lint y compilación pasan. El despliegue de reglas y la apertura del piloto siguen siendo una decisión operativa separada; no deben ejecutarse sin ventana de cambio y respaldo.
