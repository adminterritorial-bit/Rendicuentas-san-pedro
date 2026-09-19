# Instalación V11.41

1. Extraiga el ZIP.
2. Suba todos los archivos y carpetas incluidos a la raíz de la rama `main`, aceptando reemplazar los existentes.
3. Espere a que GitHub Pages finalice el despliegue.
4. Abra `actualizar.html` usando la misma ruta base del portal.
5. Inicie sesión, realice un cambio pequeño y guárdelo.

## Comprobación en consola

Ejecute:

```js
FirebasePortal.auditPayload()
```

El resultado esperado comienza con:

```js
{ ok: true, bytes: ..., schemaVersion: 11.1 }
```

En Network deben cargarse:

- `portal-core-v1141.js?v=11.41-firestore-schema-native`
- `firebase-auth-v1141.js?v=11.41-firestore-schema-native`

## Reglas

`firestore.rules` se incluye para revisión y despliegue mediante Firebase Console o Firebase CLI. GitHub Pages no publica reglas de Firestore.

No cambie las reglas actuales únicamente por un error `Function setDoc() called with invalid data`: ese error se produce en el SDK antes de consultar las reglas. Revise o publique las reglas solo si, después de instalar esta versión, aparece `permission-denied`.
