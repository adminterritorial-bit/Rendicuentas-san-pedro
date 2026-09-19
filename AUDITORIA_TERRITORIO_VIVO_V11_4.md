# Auditoría funcional V11.4 — Territorio Vivo

## Integración segura

Los nuevos componentes no requieren modificar los archivos HTML. La sección se
inyecta después del explorador del Inicio y está encapsulada con selectores
`territory-*`, reduciendo el riesgo de afectar los módulos existentes.

## Mapa

- Centro inicial: San Pedro, Valle del Cauca.
- Zoom, desplazamiento, escala y ventanas informativas.
- Carga diferida cuando la sección se aproxima al área visible.
- Cartografía base de OpenStreetMap con atribución.
- Vista visual de respaldo si Leaflet o las teselas no están disponibles.
- Los puntos de afectaciones, obras y participación se cargan desde el portal.

## Integridad de la información

El módulo no incluye afectaciones ni cifras ficticias. El administrador debe
registrar los eventos con coordenadas y, cuando exista soporte, población
afectada, fecha, estado, descripción y enlace de evidencia.

## Administración

El botón `Gestionar datos` aparece únicamente con permisos administrativos.
Abre un diálogo independiente para crear, editar, eliminar y exportar puntos.

## Animaciones

- Tarjetas que resaltan el elemento activo y difuminan las demás.
- Profundidad ligera según la posición del cursor.
- Contornos topográficos, pulsos cartográficos y órbitas.
- Narrativa de cuatro pasos controlada por desplazamiento.
- Versión ligera para dispositivos táctiles y movimiento reducido.

## Datos territoriales iniciales

Se incluyen la cabecera y los corregimientos identificados en información
pública del municipio. Las coordenadas son referencias cartográficas abiertas;
no sustituyen cartografía oficial, límites prediales ni certificaciones.
