# Auditoría y limpieza V12

## Problema principal corregido

La versión anterior guardaba casi todo el estado en `portal/main`. Para admitir estructuras no compatibles con Firestore, usaba marcadores y envoltorios de arreglos. Las versiones históricas de esos marcadores contenían nombres con el patrón reservado `__...__`, causante del error:

`Document fields cannot begin and end with "__" (found in document portal/main)`

La solución V12 elimina ese formato. El estado se divide por secciones y cada sección se guarda como JSON dentro de un campo ordinario `payload`.

## Limpieza ejecutada

- Eliminadas seis copias idénticas de `portal-core`.
- Eliminadas seis copias idénticas del servicio Firebase.
- Eliminados prototipos antiguos `app.js`, `script.js` y `shared.js`.
- Eliminado el editor paralelo `inline-admin.js`, que no se cargaba.
- Eliminados adaptadores sin uso y un módulo solicitado pero inexistente (`stack-motion.js`).
- Eliminados archivos QA y auditorías históricas que no participaban en ejecución ni despliegue.
- Eliminadas referencias a una fuente local inexistente.
- Consolidados GIF byte a byte idénticos.
- Eliminados recursos multimedia sin referencias.
- Añadida configuración completa de Firebase Hosting y `.firebaserc`.
- Simplificadas las reglas de roles y separadas las colecciones activas.

## Resultado

- Archivos iniciales: 134.
- Archivos finales: 54, incluida esta auditoría.
- Tamaño inicial: aproximadamente 6,5 MB.
- Tamaño final: aproximadamente 3,9 MB.
- Referencias locales faltantes: 0.
- Archivos JavaScript con error sintáctico: 0.

## Elementos conservados deliberadamente

`styles.css` y `claude-design.css` contienen una cantidad importante de reglas acumuladas. No se realizó una purga automática agresiva porque podría alterar la composición visual responsive y la administración. La limpieza se concentró en archivos muertos, duplicados exactos, referencias rotas y persistencia.
