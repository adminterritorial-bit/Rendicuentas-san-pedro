# Recuperación V13 — corrección conservadora

Esta versión parte directamente del ZIP original y conserva la experiencia construida.

## Módulos preservados expresamente

- `territory-experience.js`
- `territory-map-engine.js`
- `san-pedro-connected.js`
- `san-pedro-connected.css`
- `claude-design.js` y `claude-design.css`
- `motion-studio.js`
- `inline-admin.js`
- `admin-popup.js`
- todos los GIF, sonidos, imágenes y fuentes del paquete original
- todas las páginas HTML y sus scripts funcionales

## Cambios realizados

1. Se reemplazó únicamente la capa Firebase por almacenamiento seccionado en `portalState`.
2. Se conserva lectura de compatibilidad desde `portal/main`.
3. Se actualizaron las reglas para `portalState`, `portal/meta`, usuarios, ideas y auditoría.
4. El núcleo activo carga `firebase-service.js`; no se cambió la composición visual.
5. Se añadió `stack-motion.js` como compatibilidad vacía porque el núcleo original lo solicitaba, pero el archivo no existía.
6. Se añadieron `.firebaserc` y configuración de Hosting.

## Importante

No se eliminaron módulos visuales ni funcionales. Los archivos históricos y duplicados del ZIP original se conservaron en esta recuperación para evitar otra pérdida accidental. La depuración posterior debe hacerse módulo por módulo, con prueba visual previa y posterior.
