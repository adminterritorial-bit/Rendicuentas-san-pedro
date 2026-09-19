# Corrección Firebase V11.41 — RENDISAMP

## Alcance

Esta versión parte directamente de `RENDISAMP-main.zip`. No reconstruye el portal, no reemplaza el diseño y no elimina módulos visuales.

- Archivos originales recibidos: **116**.
- Archivos originales conservados: **116**.
- Archivos originales faltantes: **0**.
- Páginas HTML modificadas visualmente: **0**.
- En los 12 HTML solo cambió el identificador de versión usado para invalidar caché.
- Se conservaron sin cambios `styles.css`, `claude-design.css`, `claude-design.js`, `home.js`, `home-experience.js`, `territory-experience.js`, `stack-motion.js`, `motion-studio.js` y todos los recursos de `assets/`.

## Fallos encontrados

### 1. Campo reservado que impedía guardar

El serializador activo utilizaba este nombre como marcador interno:

```text
__sp_firestore_array_v1__
```

Firestore reserva los nombres con formato `__...__`. Cuando el estado contenía arreglos dentro de otros arreglos, el portal generaba ese campo y la escritura podía ser rechazada.

### 2. Reglas declaradas, pero archivo ausente

`firebase.json` indicaba que las reglas estaban en `firestore.rules`, pero ese archivo no existía en el repositorio. En consecuencia, el despliegue de reglas no era reproducible desde GitHub ni desde una copia nueva del proyecto.

### 3. Todo el portal se guardaba en `portal/main`

El estado completo, incluyendo contenido editable, noticias, vigencias, recursos y configuraciones, se escribía en un solo documento. Esto hacía frágil la sincronización y acercaba el documento al límite de tamaño, especialmente al incrustar imágenes en base64.

### 4. No existía configuración completa para Firebase Hosting ni GitHub Actions

Faltaban `.firebaserc`, la sección `hosting` y el flujo automático de despliegue.

## Correcciones aplicadas

### Persistencia nueva y compatible

El estado se distribuye en:

```text
portalState/years
portalState/resources
portalState/dashboards
portalState/commitments
portalState/citizenRequests
portalState/news
portalState/settings
portalState/content
portalState/pageSettings
portalState/meta
```

Las ediciones contextuales se guardan en:

```text
portalEdits/{id}
```

Las propuestas ciudadanas continúan en:

```text
ideas/{id}
```

Cada sección principal se almacena como JSON validado. Esto evita los campos reservados y los arreglos anidados incompatibles.

### Migración sin borrar información

El portal intenta leer primero el esquema nuevo. Si aún no existe, lee el documento histórico `portal/main`.

`portal/main` se conserva como respaldo y no se elimina automáticamente. La migración se produce únicamente cuando un usuario autorizado realiza un guardado correcto.

### Roles y permisos

Las reglas aceptan perfiles por UID y conservan compatibilidad de lectura con perfiles antiguos cuyo identificador era el correo electrónico.

Roles con edición:

```text
super_admin
admin
editor
```

También se aceptan alias antiguos usados por el proyecto, como `administrador`, `super-admin` y `Super Admin`.

### Control de tamaño

- Límite preventivo por sección: **850 KB**.
- Imagen incrustada desde el editor: máximo **600 KB**.
- Para imágenes mayores debe usarse una URL de Google Drive.

### Despliegue automático

Se añadió:

```text
.github/workflows/firebase-deploy.yml
.firebaserc
firebase.json
firestore.rules
verificar-firebase.mjs
```

Cada `push` a `main` ejecuta la verificación y, si pasa, despliega:

```text
firestore:rules
hosting
```

No se ejecuta `firebase login` dentro de GitHub. GitHub Actions utiliza una cuenta de servicio almacenada como secreto.

## Configuración inicial de GitHub

La automatización espera este secreto:

```text
FIREBASE_SERVICE_ACCOUNT_RENDICION_DE_CUENTAS_6ACEB
```

El valor debe ser el JSON completo de una cuenta de servicio autorizada para publicar Firebase Hosting y reglas de Firebase.

Ruta en GitHub:

```text
Repositorio
→ Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

Nombre:

```text
FIREBASE_SERVICE_ACCOUNT_RENDICION_DE_CUENTAS_6ACEB
```

Después de guardar el secreto, un `push` a `main` activa el flujo automáticamente. También puede ejecutarse manualmente desde la pestaña **Actions**.

## Primer superadministrador

La cuenta debe iniciar sesión una vez. Después, en Firestore, debe existir:

```text
users/{UID}
```

Con al menos:

```text
role: "super_admin"
active: true
uid: "UID_REAL_DE_AUTHENTICATION"
email: "correo@dominio.com"
```

## Verificación local

Ejecutar desde la raíz:

```bash
node verificar-firebase.mjs
```

Resultado esperado:

```text
VERIFICACIÓN CORRECTA: 13 archivos críticos, 12 páginas y JavaScript válido.
```

## Archivos funcionales modificados

- `firebase-auth-v11409.js`: autenticación, roles, lectura, escritura y migración.
- `firebase-service.js`: misma capa de compatibilidad Firebase.
- `admin-popup.js`: control preventivo del tamaño de imágenes.
- `portal-core-v11409.js`: únicamente identificador de compilación.
- 12 archivos HTML: únicamente identificador de compilación/caché.
- `firebase.json`: reglas, Hosting y emulador.

## Limitación de la validación

Se verificó sintaxis JavaScript, referencias locales, estructura, serialización y conservación de archivos. No se desplegaron reglas ni se escribió en el proyecto real porque esta copia no contiene credenciales administrativas de Firebase. Esa validación final ocurre al ejecutar el flujo de GitHub con la cuenta de servicio autorizada.
