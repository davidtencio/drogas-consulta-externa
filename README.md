# Control de Drogas — Consulta Externa

Aplicación de control de inventario de medicamentos para consulta externa.
Registra existencias, movimientos (ingresos/egresos por prescripción) y el
personal farmacéutico autorizado, con trazabilidad completa.

## Stack

- **Next.js 16** (App Router) — la interfaz es un cliente que habla directo con
  Firestore.
- **Firebase**
  - **Firestore** como base de datos (SDK web en el cliente).
  - **Firebase Auth** con inicio de sesión de **Google**; el login protege toda
    la app.
- **Tailwind CSS 4**.
- **Firebase App Hosting** para el despliegue (SSR sobre Cloud Run), conectado
  al repositorio de GitHub.

## Requisitos

- Node.js `>=22.13.0`
- Firebase CLI (`npm i -g firebase-tools`) para desplegar reglas.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint
```

La configuración web de Firebase (pública) está en `app/firebase.ts`.

## Modelo de datos (Firestore)

- `medicines` — catálogo con existencias, stock mínimo, lote y vencimiento.
- `pharmacists` — personal autorizado.
- `movements` — bitácora inmutable de ingresos/egresos; cada movimiento ajusta
  el stock del medicamento dentro de una transacción.

## Seguridad

Las reglas (`firestore.rules`) exigen usuario autenticado. Con Google como
proveedor, **cualquier cuenta de Google autenticada** pasa la regla básica; para
restringir a personal autorizado, use una lista blanca de correos en las reglas.

Desplegar reglas:

```bash
firebase deploy --only firestore:rules
```

## Despliegue (Firebase App Hosting)

El despliegue es automático: App Hosting está conectado a este repositorio de
GitHub y compila con `next build` en cada push a la rama de producción. La
configuración de runtime está en `apphosting.yaml`.
