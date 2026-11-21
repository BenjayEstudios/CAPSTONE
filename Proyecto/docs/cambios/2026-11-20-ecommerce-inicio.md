# Ecommerce: inicio

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-89

## Qué cambió

El inicio del ecommerce, siguiendo la portada de `Mockups/CompraMejor
Cliente.html`, con datos reales del API:

| Criterio de KAN-89 | Dónde |
|---|---|
| Buscador visible que redirige a resultados | Cabecera (todas las páginas): `/catalogo?q=…`. Además "Ejemplo: arroz" en la portada |
| Categorías de nivel 1 y 2 con conteo de productos | Columna derecha del inicio y barra de categorías de la cabecera |
| "Mayor diferencia de precio hoy" con datos reales | `GET /catalogo/productos?orden=diferencia&porPagina=5`: nombre, rango "de $X a $Y", n.º de distribuidores y la diferencia en magenta; enlaza a la ficha |
| "Ver catálogo completo" y "Ver carro" con cantidad y total | Botón cian de la portada; "Ver carro · 3 · $71.530 · 3 proveedores" en la cabecera (`CarroState`, desde `GET /carro`) |

Además, los contadores del mockup (proveedores activos y productos
comparados) con el efecto de "tinta desfasada": el número en negro con
copias en cian, magenta y amarillo corridas, como una impresión offset mal
registrada.

**API nueva:** `GET /catalogo/resumen` (pública) → `{ proveedoresActivos,
productosComparados, categorias: [{ id, nombre, slug, productos, hijos }] }`.
Cuenta productos **visibles** (mismo criterio que el listado del catálogo);
una categoría de nivel 1 suma los propios y los de sus hijas. Se incluyen las
categorías con 0; el ecommerce no las muestra.

**Cabecera nueva:** franja con la fecha y los proveedores activos; marca con
lema, buscador y carro; barra de categorías (nivel 1 en negrita). En el
teléfono la fila de la marca deja solo el carro y Salir/Ingresar.

Rutas provisorias nuevas, porque el inicio enlaza a ellas: `/producto/:id`
(KAN-92) y `/carro` (KAN-94, con sesión). `/catalogo` muestra lo que se
buscó hasta que llegue KAN-91.

## Por qué así

- **Un endpoint de resumen** en vez de contar en el navegador: contar por
  categoría con `/catalogo/productos` serían N llamadas, y los proveedores
  activos no salen de ningún endpoint público.
- **El carro se lee solo para compradores.** `GET /carro` exige una
  organización `cliente`; para un invitado o un proveedor el botón queda en
  "0 · $0". El total usa precio actual × cantidad, igual que el backend al
  crear la orden.
- **Las categorías sin productos no se muestran**: un enlace a una
  categoría vacía no ayuda a comprar.

## Pruebas

- Backend: `resumenCatalogo` (árbol, sumas, ocultas fuera), repositorio
  contra el seed (3 proveedores activos, la suma por categoría coincide con el
  listado), ruta pública.
- Ecommerce: `inicio.spec.ts` (contadores, categorías sin las vacías,
  diferencia con monto y enlace, ejemplo de búsqueda, error con reintentar,
  formato "34 mil"; `CarroState` con el carro de El Fogón: 3 productos,
  $71.530, 3 proveedores) y `app.component.spec.ts` (franja, categorías,
  buscador, carro con y sin sesión).
- En el navegador contra el seed: 3 proveedores, 17 productos, categorías
  con sus conteos, Harina $1.500 como mayor diferencia; sin scroll horizontal
  a 375 px.

## Toca

`packages/{domain,application,infrastructure}` (resumen del catálogo),
`apps/backend/src/routes/catalogo/{resumen,index}.ts`,
`apps/ecommerce/src/app/{app.component.*,app.routes.ts}`,
`apps/ecommerce/src/app/core/{catalogo,models/catalogo.models.ts,state/carro.state.ts}`,
`apps/ecommerce/src/app/features/{inicio,pendiente}/*`,
`apps/ecommerce/src/app/shared/formato.ts`, tests y docs.
