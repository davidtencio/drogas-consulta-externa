# Despliegue automático de las reglas de Firestore

El workflow `.github/workflows/deploy-firestore-rules.yml` publica `firestore.rules`
en el proyecto `drogas-consulta-externa` cada vez que el archivo cambia en `main`
(o manualmente desde **Actions → Desplegar reglas de Firestore → Run workflow**).
Antes de publicar, valida las invariantes de las reglas con la prueba
`app/firestoreRules.test.ts`.

## Configuración inicial (una sola vez)

### 1. Crear una cuenta de servicio para el despliegue

En la [consola de Google Cloud](https://console.cloud.google.com/iam-admin/serviceaccounts?project=drogas-consulta-externa):

1. **Crear cuenta de servicio**, por ejemplo `github-rules-deployer`.
2. Asignarle el rol **Firebase Rules Admin** (`roles/firebaserules.admin`). Es lo
   mínimo para publicar reglas; no necesita más.
3. En la cuenta creada → **Claves → Agregar clave → Crear clave nueva → JSON**.
   Se descarga un archivo JSON. Trátelo como secreto: no lo suba al repo.

> Esta cuenta es solo para desplegar reglas. Es distinta de la cuenta de servicio
> del *runtime* de App Hosting, que necesita `roles/datastore.user` para que el
> backend `/api/admin/mutations` escriba en Firestore (ver `pilot-runbook.md`).

### 2. Guardar la clave como secreto de GitHub

En el repositorio → **Settings → Secrets and variables → Actions → New repository
secret**:

- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Secret:** el contenido completo del archivo JSON descargado.

## Uso

- **Automático:** al hacer merge a `main` de un cambio en `firestore.rules`, el
  workflow corre y publica.
- **Manual:** pestaña **Actions → Desplegar reglas de Firestore → Run workflow**.

## Verificación tras publicar

En la [consola de Firestore → Reglas](https://console.firebase.google.com/project/drogas-consulta-externa/firestore/rules)
confirme que la versión publicada coincide con `firestore.rules` del repo y revise
el historial de publicación.

## Seguridad

- La clave JSON nunca se imprime: se escribe a un archivo temporal del runner y se
  borra al final (paso `Limpiar credencial`, `if: always()`).
- El workflow usa `permissions: contents: read` (mínimo) y `concurrency` para no
  solapar despliegues.
- Si sospecha que la clave se filtró, elimínela en la consola de Cloud (Claves de
  la cuenta de servicio) y genere una nueva; luego actualice el secreto.
