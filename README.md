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
npm test         # ejecuta las pruebas una vez
```

La configuración web de Firebase (pública) está en `app/firebase.ts`.

### Modo demostración

Permite revisar la interfaz sin iniciar sesión y sin leer o escribir datos de
Firebase. Todos los medicamentos, farmacéuticos y movimientos son ficticios;
los cambios se guardan únicamente en memoria y se restablecen al reiniciar.

En PowerShell:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='1'
npm run dev
```

No configure `NEXT_PUBLIC_DEMO_MODE=1` en producción. El valor predeterminado
es `0`, documentado en `.env.example`.

### Piloto controlado

Para identificar un despliegue autenticado de piloto sin desactivar Firebase,
configure `NEXT_PUBLIC_PILOT_MODE=1`. La interfaz mostrará un aviso persistente;
los permisos continúan aplicándose mediante Auth y las reglas de Firestore.

## Pruebas

Las pruebas usan **Vitest** con **React Testing Library** (entorno `jsdom`).

```bash
npm test              # corre toda la suite una vez
npm run test:watch    # modo interactivo (re-ejecuta al guardar)
npm run test:coverage # reporte de cobertura
```

Convención: cada archivo de prueba vive junto al código que verifica, con
sufijo `.test.ts` / `.test.tsx`.

- `app/lib/inventory.ts` concentra la **lógica de dominio pura** (existencias,
  stock bajo, filtrado, validación de movimientos). Es la capa con mayor valor
  de prueba y se cubre en `app/lib/inventory.test.ts`.
- Los componentes se prueban con Firebase **mockeado** (ver
  `app/login.test.tsx`), sin red ni credenciales reales.

Conforme la app crece, agregue lógica nueva en `app/lib/` con su prueba
correspondiente, y una prueba de componente cuando cambie el comportamiento de
la interfaz.

## Modelo de datos (Firestore)

- `medicines` — catálogo con existencias, stock mínimo, lote y vencimiento.
- `pharmacists` — personal autorizado.
- `movements` — bitácora inmutable de ingresos/egresos (ajustan el stock dentro
  de una transacción) y de **conteos físicos / arqueos** (registran físico vs.
  sistema y la diferencia como evidencia, sin alterar existencias).

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
