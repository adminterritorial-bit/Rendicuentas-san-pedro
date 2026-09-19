# Auditoría técnica V11.0

## Alcance revisado

Se revisaron completamente los tres archivos entregados en V10.40: `shared.js`, `claude-design.js` y `claude-design.css`. El paquete recibido no contenía los HTML, `styles.css`, `inline-admin.js`, `firebase-service.js`, `drive-service.js` ni los scripts específicos de cada página.

## Fallos críticos encontrados y corregidos

1. **Los botones de edición dependían de `inline-admin.js`, archivo ausente del paquete.** El código esperaba `window.InlineAdmin.openConsole`, por lo que un botón podía verse pero no tener editor disponible. Se eliminó esa dependencia y se creó `admin-popup.js`.
2. **Había una carrera de eventos en los botones Editar.** Un listener llamaba `preventDefault()` y después esperaba 140 ms para comprobar si otro editor había abierto. Esto generaba clics perdidos, doble apertura o ninguna respuesta. Ahora existe un único manejador en captura.
3. **El sistema obligaba a abrir una barra administrativa.** `shared.js` añadía clases y forzaba `#inlineAdminToolbar.open`. Se retiró esa lógica. La administración general y la edición contextual funcionan como ventanas emergentes.
4. **Las clases del editor se borraban en `DOMContentLoaded`, `load` y `pageshow`.** Esto podía cerrar el editor inmediatamente después de abrirlo. Se eliminó ese reinicio repetido.
5. **Funciones visuales antiguas seguían activas.** Había listeners globales para GIF de clic, gato, loader en cada enlace y loader en cada formulario. Generaban nodos, solicitudes a archivos y bloqueos visuales. Fueron retirados.
6. **Versiones de caché incoherentes.** V10.40 seguía cargando CSS, diseño e `inline-admin.js` con la etiqueta `10.33-home-compacto-ordenado`. Se unificó en `11.0-admin-popup`.
7. **Promesa de Google Drive sin manejo completo del error.** La carga podía producir rechazo no controlado. Ahora el error se absorbe sin detener la inicialización del editor.
8. **`IntersectionObserver` se usaba sin alternativa.** En navegadores sin soporte podía fallar la inicialización de animaciones. Se añadió fallback.
9. **Documentación acumulada de ocho versiones.** Se retiraron los QA e instructivos históricos del paquete nuevo.
10. **La barra heredada podía reaparecer desde HTML o caché.** V11 elimina nodos heredados y además los neutraliza desde CSS.

## Nuevo sistema de administración

- Botón **Administrador** abre `#adminPanel` como popup centrado.
- Apariencia, vigencias, recursos, ideas, conexiones y respaldo quedan dentro del popup.
- Los botones **Editar sección** y **Editar** abren un popup contextual.
- El editor contextual permite modificar textos, imágenes, texto alternativo, fondo, color, espaciado, redondeado, ancho máximo y altura mínima.
- Los cambios se guardan en `Portal.state.content.contextEdits`, pasan por `Portal.helpers.save()` y solicitan sincronización de Firebase cuando el servicio está disponible.
- Las imágenes locales tienen límite de 1,5 MB para evitar exceder la cuota de `localStorage`; para archivos mayores se mantiene Google Drive.

## Dependencias externas que deben permanecer en GitHub

- `firebase-service.js`
- `drive-config.js`
- `drive-service.js`
- Los HTML, scripts de página, `styles.css` y la carpeta `assets` del portal actual.

`inline-admin.js` deja de ser necesario para V11.
