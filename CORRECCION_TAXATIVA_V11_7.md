# Corrección taxativa V11.7

- Se volvió a la base V11.5.
- Leaflet es el único motor de mapa.
- Se eliminó MapLibre y la dependencia de WebGL.
- Se eliminó la vista radial simulada.
- El único popup de carga es `#spLoadingPopup`.
- Carga: `loading-spinner.gif`.
- Finalización: `ok-hand.gif` y `notification.mp3`.
- Se desactivó View Transition para evitar `Transition was skipped`.

`ERR_BLOCKED_BY_CLIENT` de Firestore corresponde a un bloqueo del navegador o
una extensión de privacidad; el código del portal no puede desactivar
extensiones instaladas.
