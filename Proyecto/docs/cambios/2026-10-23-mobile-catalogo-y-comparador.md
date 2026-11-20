# Mobile: catálogo, búsqueda, filtros y comparador

**Fecha:** 2026-10-23 · **Épica:** KAN-87 · **Tickets:** KAN-127, KAN-128, KAN-129

Nueva feature `catalogo` en `apps/mobile` para el comprador:

- **Inicio (KAN-127)**: saludo, buscador, grilla de categorías y "Mayor
  diferencia de precio hoy" (productos donde más se ahorra eligiendo bien el
  proveedor).
- **Listado con filtros (KAN-128)**: búsqueda mientras se escribe (sin tildes
  ni mayúsculas), filtros por categoría (incluye subcategorías), plazo de
  entrega 24/48 h, caja chica (hasta 6 unidades) y orden (relevancia, menor
  precio, mayor ahorro, nombre); precio por formato o por kg/L.
- **Ficha con comparador (KAN-129)**: todas las ofertas publicadas con
  precio, $/kg, plazo, caja, modalidad, stock, despacho y calificación del
  proveedor; orden por precio, plazo o calificación, e insignias "Más bajo",
  "Más rápido" y "Mejor calificado".

**Por qué**: el backend aún no expone `GET /productos` ni
`GET /productos/:id`. La app usa un fake con el seed (incluidas las
calificaciones de KAN-142) y los dos endpoints quedaron especificados en
`apps/mobile/API_CONTRACT.md`: filtros, orden, qué ofertas son visibles y
forma del JSON. "Agregar al carro" avisa que llega con KAN-130.

**Toca**: `apps/mobile/lib/features/catalogo/` (nuevo),
`lib/core/fake/seed.dart` (categorías, productos, ofertas, proveedores,
calificaciones), `lib/core/format/formatos.dart`, `lib/core/router/*`,
`test/`, `API_CONTRACT.md`, `README.md`, `lib/features/README.md`.
