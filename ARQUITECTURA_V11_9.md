# Arquitectura V11.9 — San Pedro Conectado

## Integración

La experiencia se carga después de `territory-experience.js`. Su hoja de
estilos y su JavaScript son independientes. La sección se inserta después de
`#territoryStory`, por lo que no reemplaza el mapa ni modifica sus controles.

## Red territorial

La red utiliza Canvas 2D para dibujar conexiones y botones HTML para mantener
accesibilidad. Los datos se leen desde la API pública de `TerritoryExperience`.

## Narrativa

La Ruta de la gestión utiliza IntersectionObserver y un visual sticky. No
requiere librerías externas.

## Comparador

El comparador funciona con una capa anterior, una capa posterior y un input
range transparente. Las imágenes se configuran desde un popup administrativo.

## Rendimiento

El Canvas se detiene fuera del viewport y cuando la pestaña está oculta. En
movimiento reducido se presenta una composición estática.
