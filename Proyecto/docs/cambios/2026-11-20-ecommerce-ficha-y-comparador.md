# Ecommerce: ficha de producto y comparador

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Tickets:** KAN-92, KAN-93

## Qué cambió

`/producto/:id` dejó de ser una pantalla provisoria. Es la ficha única del
producto con el comparador de distribuidores, siguiendo el mockup de la ficha.

### Ficha con comparador (KAN-92)

| Criterio | Cómo |
|---|---|
| Ficha única con formato y SKU | Migas (Catálogo / categoría padre / categoría / producto), nombre, "Caja 1 L · Colún · SKU LEC-0001", imagen o marcador con el formato |
| Tabla de todos los distribuidores ordenada por precio unitario | Columnas Distribuidor (con zona, ★ calificación y despacho), Precio unitario, Precio por kg/L, Entrega, Mínimo y **Comprar**; el primero lleva "Más bajo" |
| Precio más bajo hoy y diferencia | "Precio más bajo hoy" en grande, su precio por kg/L, cuántos distribuidores lo publican y "$400 entre el más barato y el más caro" |
| Comprar desde la oferta elegida | Agrega esa oferta al carro (`PUT /carro` con los ítems actuales más este, o suma cajas si ya estaba). Pide las cajas enteras que cumplen el mínimo (el mínimo está en unidades). Sin sesión lleva a `/ingresar?returnUrl=…`; un proveedor ve "Las compras se hacen con una cuenta de comprador" |
| Registrar `vista_producto` y `click_oferta` | `vista_producto` una vez por producto al abrir la ficha, con `origen` `catalogo`, `busqueda` o `directo` (los enlaces del catálogo y de la búsqueda pasan `?origen=`). `click_oferta` en cada Comprar, con `convirtio: false` (la conversión la marca el checkout) |

### Comparación lado a lado (KAN-93)

| Criterio | Cómo |
|---|---|
| Los tres más baratos en columnas | Selector "Tabla · Lado a lado" (queda en la URL como `?vista=lado`) y botón "Comparar lado a lado" bajo la tabla. Una columna por distribuidor con la regla de color arriba, como en el mockup |
| Precio, precio por kg/L, plazo, mínimo, calificación y despacho | Una fila por dato; el precio muestra "más bajo" o "+$30" respecto del más barato |
| Comprar desde cada columna | "Comprar a Los Andes Food Service", etc., con el mismo flujo que la tabla |
| Ver todos | "Ver los N en tabla" vuelve a la tabla completa |

### API (`GET /catalogo/productos/:id`, aditivo)

`ofertas[].proveedor.zona: { comuna, region } | null`, la comuna y región de
la dirección del distribuidor. La tabla del mockup muestra de dónde despacha
cada uno, y eso no venía en la respuesta.

## Por qué así

- **Comprar agrega al carro, no compra.** El checkout es único para todo el
  carro (KAN-95), así que Comprar en la ficha deja la oferta en el carro y
  avisa con "Ver carro". El carro sigue siendo multiproveedor.
- **`PUT /carro` reemplaza el carro completo** (KAN-130), por eso el
  ecommerce manda lo que ya tenía más la oferta nueva (`CarroState.agregar`).
- **Lado a lado son los 3 más baratos**, como en el mockup. Con más columnas
  no cabe en una pantalla, y la tabla ya muestra todos.
- **Una `vista_producto` por producto y visita de la ficha**: cambiar de vista
  o reintentar no la repite, para no inflar el embudo del proveedor.

## Pruebas

- Backend: el test de la ficha del repositorio incluye `zona`.
- Ecommerce (`features/producto/producto.spec.ts`): formato, SKU, precio más
  bajo y diferencia; `vista_producto` con su origen; tabla completa con
  "Más bajo"; lado a lado con los 3 más baratos, diferencias y botones;
  Comprar sin sesión (`click_oferta` y redirección), como comprador (`PUT
  /carro` con el carro anterior más la oferta) y como proveedor; 404 amable;
  `cajasMinimas`.
- En el navegador contra el backend local: ficha del aceite (diferencia $400)
  y de la leche lado a lado (+$30, +$60), Comprar como El Fogón (agregó la
  línea y la segunda vez sumó a 2 cajas; el carro se dejó como estaba) y los
  eventos en `evento_analitico`.

## Archivos

- `packages/domain/src/dtos/catalogo.dto.ts`: `zona` en el proveedor de la oferta.
- `packages/infrastructure/src/repositories/catalogo.repository.ts`: join a `direccion` y `comuna` del distribuidor.
- `apps/ecommerce/src/app/features/producto/`: componente, plantilla, estilos y spec.
- `apps/ecommerce/src/app/core/state/carro.state.ts`: `agregar`; `core/api/api.client.ts`: `put`.
- `apps/ecommerce/src/app/core/analitica/analitica.service.ts`: `vistaProducto`, `clickOferta`.
- `apps/ecommerce/src/app/core/catalogo/catalogo.service.ts` y `core/models/catalogo.models.ts`: `ficha(id)` y sus tipos.
- `apps/ecommerce/src/app/app.routes.ts`: la ruta real de `/producto/:id`.
- `apps/ecommerce/src/app/features/catalogo/catalogo.component.html`: `?origen=` en los enlaces.
