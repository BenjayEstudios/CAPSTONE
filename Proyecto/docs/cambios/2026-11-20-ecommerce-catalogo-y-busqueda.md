# Ecommerce: catálogo con filtros y búsqueda

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Tickets:** KAN-90, KAN-91

## Qué cambió

### `/catalogo` (KAN-90)

| Criterio | Cómo |
|---|---|
| Filtros por categoría, plazo (24 h / hasta 48 h), mínimo de compra | Columna de filtros como la del mockup: categorías de nivel 1 y 2 con su conteo, plazo "Cualquiera · 24 h · Hasta 48 h", mínimo "Cualquiera · Sin mínimo · Hasta 6 unidades" |
| Precio "desde", precio por kg/L, plazo y n.º de proveedores | En cada tarjeta y en cada fila: "Desde $12.490 · $2.498/L · entrega desde 24 h · Comparar 2 distribuidores" |
| Vista grilla y vista tabla | "Tarjetas" / "Tabla" (las variantes "Tarjetas" y "Lista densa" del mockup); la elección se recuerda en el navegador |
| Ordenado por precio más bajo | Es el orden por defecto; también "mayor diferencia entre distribuidores" y "nombre" |

### `/buscar?q=` (KAN-91)

| Criterio | Cómo |
|---|---|
| Resultados para «término» con conteo | "Resultados para «aceite» · 2 productos" |
| Refinar: entrega 24 h, sin mínimo, proveedor con retiro, marca propia | Chips "Solo entrega en 24 h", "Sin mínimo de compra", "Distribuidor con retiro" y un selector de **marca** (ver abajo) |
| Proveedor más barato y diferencia con el más caro | "2 distribuidores, desde **Los Andes Food Service** — el más caro publica $12.890 (diferencia $400)" |
| Búsquedas sin resultados registradas (`busqueda`, `resultados = 0`) | Cada término nuevo manda `POST /eventos/lote` con `{ tipo_evento: "busqueda", termino, resultados }` (refinar o paginar no lo repite). Comprobado en `evento_analitico` |

Sin resultados: mensaje, sugerencia de categorías y, si había filtros,
"Quitar los filtros". El buscador de la cabecera y "Ejemplo: arroz" del
inicio llevan a `/buscar`.

Los filtros viven en la URL (`?categoria=8&plazo=24`, `?q=aceite&retiro=1`):
se pueden compartir y el botón atrás funciona. En el teléfono las categorías
van en una fila que se desplaza y las tarjetas en dos columnas.

### API (`GET /catalogo/productos`, aditivo)

- Parámetros nuevos: `maxMinimoCompra` (una oferta sin mínimo cuenta como
  1), `conRetiro=true` (modalidad `retiro` o `ambos`), `marca`.
- Cada producto trae `proveedorMasBarato: { id, nombre }`: el de la oferta
  más barata entre las que cumplen los filtros (sale del mismo `GROUP BY`,
  con `GROUP_CONCAT` ordenado).
- La respuesta trae `marcas: [{ marca, productos }]`, calculadas **sin** el
  filtro de marca para poder cambiarla.

## Por qué así

- **"Marca propia" se resolvió como filtro por marca.** El modelo no tiene
  cómo saber si un producto es marca propia de un distribuidor (no hay campo
  para eso). Quedó como [decisión abierta](../decisiones/DECISIONES-ABIERTAS.md).
- **"entrega desde 24 h"**: el plazo del listado es el más corto entre los
  distribuidores, que puede no ser el del más barato; decir "desde" evita
  prometer que el más barato entrega en 24 h.
- **Un evento por término**, no por cada refinamiento: así el reporte de
  términos sin resultados cuenta búsquedas, no clics en filtros.

## Pruebas

- Backend: repositorio contra el seed (proveedor más barato, retiro contra
  un conteo directo en SQL, mínimo de compra, marcas que no se filtran a sí
  mismas), caso de uso (parámetros nuevos).
- Ecommerce (`features/catalogo/catalogo.spec.ts`): orden y parámetros por
  defecto, filtros de la URL al API, volver a la página 1 al filtrar, vista
  tabla recordada; búsqueda con conteo, más barato y diferencia, un solo
  evento por término, refinamientos al API, sin resultados con
  `resultados = 0`.
- En el navegador contra el seed: 17 productos por precio; 24 h → 15;
  Lácteos + 24 h → 5 en tabla; búsqueda «aceite» como el mockup;
  «salmón ahumado» quedó en `evento_analitico` con 0 resultados.

## Toca

`packages/{domain,application,infrastructure}` (filtros y campos del
catálogo), `apps/ecommerce/src/app/features/catalogo/*`,
`apps/ecommerce/src/app/core/{catalogo,analitica,models}/*`,
`apps/ecommerce/src/app/shared/formato.ts`, `app.routes.ts`,
`app.component.ts`, `features/inicio`, tests y docs.
