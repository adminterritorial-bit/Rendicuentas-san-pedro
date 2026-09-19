# Auditoría Firestore V11.41

## Hallazgos confirmados

1. `years[].sectors` se almacenaba como una matriz: `[[nombre, porcentaje], ...]`.
2. Cloud Firestore no admite un arreglo como elemento directo de otro arreglo.
3. La V11.40.9 intentó encapsular esas matrices con el campo `__sp_firestore_array_v1__`.
4. Firestore reserva los nombres de campo que coinciden con `__.*__`; por eso la V11.40.9 sustituyó un error de validación por otro.
5. El repositorio contenía `firebase.json` apuntando a `firestore.rules`, pero el archivo `firestore.rules` no estaba incluido.
6. Las solicitudes `Write/Listen ... TYPE=terminate` son cierres del canal WebChannel. No son la causa del rechazo local de `setDoc` por estructura inválida.

## Reestructuración aplicada

- `sectors` ahora utiliza una lista nativa de objetos:

  ```js
  [{ name: "Infraestructura", value: 94 }]
  ```

- La lectura sigue aceptando el formato histórico `[nombre, valor]` y lo migra automáticamente.
- Se corrigieron también los formularios que crean nuevas vigencias para que no vuelvan a generar matrices.
- Existe una capa defensiva reversible para datos antiguos o módulos futuros. Sus campos son válidos para Firestore:
  - `spEncodedType`
  - `spEncodedItems`
  - `spEncodedEntries`
- Los campos locales con nombres reservados se encapsulan sin escribir nombres `__.*__` en Firestore.
- Se preservan valores nativos de Firestore como `Timestamp`, `GeoPoint`, `Bytes` y `DocumentReference`.
- Antes de escribir se valida:
  - arreglos anidados directos;
  - campos reservados;
  - profundidad;
  - nombres de campo demasiado largos;
  - tipos no serializables;
  - referencias circulares;
  - tamaño aproximado del documento.
- El documento `portal/main` se guarda antes de ideas y auditoría. Un fallo secundario no invalida el contenido principal.
- Se agregó control de sincronización pendiente para no perder un cambio realizado mientras otra escritura está en curso.

## Pruebas ejecutadas

- Estado inicial completo cargado en Chromium sin errores de página.
- Auditoría del documento principal: 0 matrices anidadas y 0 campos reservados.
- Tamaño aproximado del documento inicial: 25.671 bytes.
- Migración de una vigencia histórica con sectores en formato matriz: correcta.
- Migración defensiva de datos con matrices y campos `__.*__`: reversible.
- Validación con el serializador real de Firebase JS 12.15.0:
  - documento V11.41: aceptado;
  - documento defensivo: aceptado;
  - control con matriz sin corregir: rechazado;
  - control con campo `__...__`: rechazado.
- Validación de sintaxis JavaScript de todos los archivos incluidos: correcta.

## Reglas

El archivo `firestore.rules` incluido cubre:

- lectura pública del portal y de ideas;
- escritura del portal por perfiles activos `super_admin`, `admin` o `editor`;
- compatibilidad temporal con perfiles antiguos guardados por correo;
- creación pública validada de ideas;
- administración de usuarios por superadministrador;
- registros de auditoría.

Subir `firestore.rules` a GitHub Pages no publica las reglas. El error exacto `invalid data` ocurre antes de evaluar reglas. Solo será necesario publicar o ajustar reglas cuando Firebase responda `permission-denied` después de que el documento pase la validación local.
