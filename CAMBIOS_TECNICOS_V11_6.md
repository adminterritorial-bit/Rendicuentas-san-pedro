# Cambios técnicos V11.6

## Panel territorial

Se eliminaron alturas heredadas en los botones de resultados. Cada localidad
usa altura automática, mínimo de 58 px, texto multilínea y separación real
entre nombre, tipo y valor. En móvil se fuerza una sola columna.

## Motor cartográfico

MapLibre GL JS es el motor principal. Renderiza mediante WebGL y permite:

- estilos vectoriales;
- relieve mediante raster DEM;
- inclinación y rotación;
- edificios tridimensionales cuando los datos del estilo los incluyen;
- vuelos de cámara con curva y aceleración;
- capas GeoJSON para afectaciones.

Leaflet continúa en el archivo original como respaldo automático.

## Recursos de carga

Los dos GIF se copiaron desde los archivos adjuntos del usuario. El audio de
notificación se incluye como `ui-sounds/notification.mp3` y se intenta
reproducir únicamente al finalizar una operación correctamente.
