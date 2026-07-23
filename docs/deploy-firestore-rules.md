# Despliegue automático de las reglas de Firestore

El workflow `.github/workflows/deploy-firestore-rules.yml` publica `firestore.rules`
en el proyecto `drogas-consulta-externa` cada vez que el archivo cambia en `main`
(o manualmente desde **Actions → Desplegar reglas de Firestore → Run workflow**).
Antes de publicar, valida las invariantes de las reglas con la prueba
`app/firestoreRules.test.ts`.

## Autenticación: Workload Identity Federation (sin claves)

**Ya está configurado (2026-07-23). No hay secretos que crear ni rotar.** Esta
sección documenta lo que existe, por si hay que rehacerlo o auditarlo.

La organización prohíbe crear claves de cuenta de servicio (política
`iam.disableServiceAccountKeyCreation`), así que el workflow **no** usa un JSON
guardado en un secreto. En su lugar, GitHub emite un token OIDC efímero por cada
ejecución y Google lo canjea por credenciales de corta duración de
`github-rules-deployer`. Nada persistente que se pueda filtrar.

Piezas creadas en el proyecto `drogas-consulta-externa` (número `903564757399`):

1. **Cuenta de servicio** `github-rules-deployer@drogas-consulta-externa.iam.gserviceaccount.com`
   con un solo rol, **Firebase Rules Admin** (`roles/firebaserules.admin`). No tiene
   acceso a los datos de Firestore, solo a publicar reglas.
2. **Workload identity pool** `github-actions` (location `global`).
3. **Proveedor OIDC** `github` en ese pool, emisor
   `https://token.actions.githubusercontent.com`, con la condición
   `assertion.repository=='davidtencio/drogas-consulta-externa'`. **Esa condición es
   la pieza de seguridad crítica**: sin ella, workflows de otros repos de GitHub
   podrían pedir credenciales de este proyecto.
4. **Binding** `roles/iam.workloadIdentityUser` sobre la cuenta de servicio para el
   `principalSet` de ese repositorio, que es lo que le permite suplantarla.

En el workflow esto se traduce en `permissions: id-token: write` y el paso
`google-github-actions/auth@v2` con el proveedor y la cuenta de servicio.

> Esta cuenta es solo para desplegar reglas. Es distinta de la cuenta de servicio
> del *runtime* de App Hosting (`firebase-app-hosting-compute@…`), que es la que
> escribe en Firestore desde `/api/admin/mutations`. Esa otra cuenta **ya tiene los
> permisos que necesita** a través de `roles/firebase.sdkAdminServiceAgent`; no hay
> que añadirle `roles/datastore.user` (comprobado el 2026-07-23, ver `CLAUDE.md`).

> Si algún día hay que borrar y recrear el pool: al eliminarlo queda en estado
> *soft-deleted* unos 30 días y **el nombre no se puede reutilizar** en ese plazo.

## Uso

- **Automático:** al hacer merge a `main` de un cambio en `firestore.rules`, el
  workflow corre y publica.
- **Manual:** pestaña **Actions → Desplegar reglas de Firestore → Run workflow**.

## Verificación tras publicar

En la [consola de Firestore → Reglas](https://console.firebase.google.com/project/drogas-consulta-externa/firestore/rules)
confirme que la versión publicada coincide con `firestore.rules` del repo y revise
el historial de publicación.

## Seguridad

- **No existe ninguna credencial de larga duración.** Las que usa el job caducan
  solas y valen únicamente para ese run; no hay clave que rotar ni que revocar.
- El acceso está acotado por dos lados: el proveedor solo acepta tokens del
  repositorio `davidtencio/drogas-consulta-externa`, y la cuenta de servicio solo
  puede publicar reglas (`roles/firebaserules.admin`).
- Permisos del workflow al mínimo: `contents: read` + `id-token: write` (este
  último es imprescindible para que GitHub emita el token OIDC), y `concurrency`
  para no solapar despliegues.
- Para revocar el acceso de golpe: quitar el binding
  `roles/iam.workloadIdentityUser` de la cuenta de servicio, o deshabilitar el
  proveedor OIDC.
