# Catálogo público, búsqueda y comparador

**Fecha:** 2026-11-20 · **Épica:** KAN-88 · **Ticket:** KAN-145 (desbloquea
KAN-89 a KAN-93 del ecommerce y KAN-127 a KAN-129 de mobile)

## Qué cambió

Dos rutas públicas nuevas, con la forma de
[`API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md):

| Ruta | Qué hace |
|---|---|
| `GET /catalogo/productos` | Productos con el rango de precios de sus ofertas visibles. `?q`, `categoriaId` (incluye subcategorías), `plazoMaxHoras`, `maxUnidadesPorCaja`, `orden` (`relevancia`, `precio`, `diferencia`, `nombre`), `pagina`, `porPagina` |
| `GET /catalogo/productos/:id` | Ficha con el comparador: ofertas visibles por precio unitario ascendente, cada una con proveedor, calificación, tarifa de despacho y **precio por kg/L** |

**Visible** = producto `publicado` en una categoría `activa` (y su padre
también), con oferta `publicada` de un proveedor con organización `activa`.
Un producto sin ofertas visibles no aparece.

**Agregado al contrato:** cada oferta de la ficha trae `precioNormalizado:
{ valor, por }` (precio unitario / contenido, por kg, L o unidad; `null`
sin contenido). Lo pide KAN-145 ("precio por kg/L normalizado") y así ninguna
app lo recalcula a su manera.

**Tarifa de despacho:** si el request trae el token de un comprador, se usa la
comuna de la dirección de su organización (tarifa de la comuna; si no hay, la
de la región; si solo hay por comuna, la más barata de la región). Sin
sesión, la RM (región `13`). Un token inválido no bloquea: la ruta sigue
siendo pública (`leerAuthOpcional` en `plugins/auth.ts`).

**Búsqueda:** FULLTEXT `ix_producto_nombre_fulltext` en modo booleano con
prefijo y plural simple ("quesos" → `queso*`), más `LIKE` en nombre y marca.

Lo demás de KAN-145 ya existía: el árbol de categorías (`GET
/categorias?arbol=true`, público) y el CRUD de productos y categorías del
admin (`POST/PATCH /productos`, `POST/PATCH /categorias`, con
`crear_producto`). No hay borrado físico: un producto se archiva y una
categoría se oculta, así se conserva la historia de órdenes y auditoría.

## Por qué así

- **`/catalogo/productos` y no `/productos`**: `/productos` ya es el listado de
  administración, con otra forma y otros permisos. Mobile ya lo había
  especificado así.
- **SQL a mano en el repositorio**: agregar por producto sobre ofertas
  filtradas y usar `MATCH ... AGAINST` no se expresa con el query builder de
  Drizzle sin perder legibilidad.
- **Filtros por oferta**: con `plazoMaxHoras` o `maxUnidadesPorCaja`, el
  producto aparece si al menos una oferta cumple, y los precios se calculan
  solo con esas (como pide el contrato).
- **`vista_producto` no se registra en la ficha**: las apps ya lo mandan por
  `/eventos/lote`; registrarlo también aquí lo contaría doble.

Decisiones movidas a [cerradas](../decisiones/DECISIONES-CERRADAS.md): ruta
del catálogo, búsqueda sin stemming, y de paso las ya resueltas por KAN-144
(login único, permisos por matriz).

## Antes: merge de `main`

`main` traía KAN-140 con su migración numerada `0001`, que chocaba con la del
2FA. Se mergeó `main` en `dev-benjaycosas` y la del 2FA quedó como
`0002_usuario_mfa_secreto`. La base local se recreó para aplicar 0000 → 0002.

## Pruebas

- `packages/application/src/use-cases/catalogo.use-cases.test.ts`:
  subcategorías, defaults, zona del comprador, calificación, precio
  normalizado, 404.
- `packages/infrastructure/test/catalogo.repository.test.ts` (contra el
  seed): 17 productos, exclusión de borradores, pausadas y proveedores en
  revisión, búsqueda sin tildes y en plural, filtros por oferta,
  `diferencia`, categoría oculta, tarifa por comuna y región.
- `apps/backend/src/routes/catalogo/catalogo.test.ts`: público, token
  opcional, 404 y 400.
- Probado con curl contra el seed: la ficha del aceite da exactamente lo del
  contrato (Los Andes $12.490, ★ 4,67, despacho $4.990; Valle Central
  $12.890, ★ 3,8).

`test/analitica.repository.test.ts` sigue con un caso rojo que viene de
`main`: espera un índice `ix_evento_analitico_producto_id` que ninguna
migración crea.

## Toca

`packages/domain/src/{dtos/catalogo.dto.ts,repositories/catalogo.repository.ts,dtos/index.ts,repositories/index.ts}`,
`packages/application/src/use-cases/{catalogo.use-cases.ts,index.ts}`,
`packages/infrastructure/src/repositories/{catalogo.repository.ts,index.ts}`,
`apps/backend/src/{routes/catalogo/*,routes/index.ts,plugins/auth.ts}`,
tests nuevos y docs.
