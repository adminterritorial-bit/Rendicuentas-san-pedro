# Plan exacto V11.5 — Territorio Premium

## 1. Relación de aspecto

### Escritorio
- Panel territorial entre 390 y 430 px.
- Mapa con aproximadamente el doble del ancho visual.
- Altura común entre 650 y 740 px.
- La lista absorbe el espacio restante sin alargar la tarjeta.

### Tablet
- Mapa arriba con proporción 16:10.
- Panel debajo en dos columnas: resumen y detalle a la izquierda; búsqueda y
  resultados a la derecha.

### Móvil
- Mapa en proporción 4:3.
- Métricas compactas en una fila.
- Lista limitada a 175 px.
- Tarjeta de detalle separada y legible.

## 2. Mapa premium

- Vista Plano: OpenStreetMap.
- Vista Relieve: OpenTopoMap.
- Vista Satélite: World Imagery.
- Vista Híbrido: imagen satelital con nombres y referencias.
- Selector propio de cuatro vistas.
- Scroll zoom, pinch zoom y doble clic.
- Zoom fraccionado y vuelo cinematográfico.
- Órbitas visuales al enfocar un punto.
- Estado visual de cámara y carga de capa.
- Vista territorial de respaldo sin conexión.

## 3. Narrativa visual

Cada paso admite:
- animación integrada;
- imagen por URL;
- video por URL;
- póster del video.

Animaciones iniciales incluidas:
- Registro: documentos y escritura.
- Ubicación: mapa tridimensional, ruta y pin.
- Respuesta: ondas y tarjetas de gestión.
- Evidencia: comparación, escaneo y validación.

El administrador dispone de un popup específico para cambiar los contenidos
sin editar el HTML.

## 4. Estados de carga

Se restauran los recursos:
- `ui-gifs/loading-spinner.gif`
- `ui-gifs/ok-hand.gif`

El primer GIF aparece durante la operación y el segundo confirma que terminó.
El mismo estado puede mostrarse dentro del botón que inició la acción.

## 5. Fase siguiente

La estructura queda preparada para:
- subir videos institucionales a Drive;
- añadir fotografías oficiales por barrio o corregimiento;
- incorporar polígonos GeoJSON oficiales;
- mostrar comparación antes/después;
- incorporar recorridos 3D o modelos del territorio cuando se disponga de
  cartografía y activos autorizados.
