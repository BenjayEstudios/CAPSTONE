# Ecommerce: mis pedidos y seguimiento

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-98

## Qué cambió

El comprador tiene su historial de compras con el estado de cada envío por
distribuidor. "Mis pedidos" aparece en la cabecera (solo para compradores) y
en el resultado del pago ("Seguir mi pedido").

| Criterio | Cómo |
|---|---|
| Lista de órdenes con folio, fecha, total y estado | `/pedidos`: una tarjeta por orden, de la más nueva a la más antigua, con folio, fecha (de pago, o de creación si no está pagada), n.º de distribuidores, total y estado ("Pendiente de pago", "Pago no completado", "Pagada", "En preparación", "Despachada", "Entregada"), más una línea por envío con su modalidad y estado. Filtros por estado y páginas de 10, en la URL (`?estado=&pagina=`) |
| Detalle con estado por envío | `/pedidos/:id`: el detalle consolidado de KAN-96 con el **seguimiento** de cada envío en cuatro pasos: Por despachar → En preparación → Despachado (o Listo para retiro, si es retiro) → Entregado; el paso actual resaltado. Un envío cancelado muestra solo su estado |
| Descarga de boleta/factura | La boleta o factura y las guías de despacho en PDF, igual que en la confirmación (se descargan con el token) |

Un pedido que sigue pendiente de pago muestra "Pagar ahora", que vuelve a
Webpay (`POST /ordenes/:id/pago`). Mientras no se pague, no hay seguimiento:
los distribuidores lo preparan después del pago.

No hubo cambios en el backend: `GET /ordenes` y `GET /ordenes/:id` ya daban
lo necesario (el punto de retiro se agregó en KAN-96).

## Por qué así

- **El seguimiento vive en el detalle compartido** (`detalle-orden`), así la
  confirmación y "Mis pedidos" muestran lo mismo.
- **Los pasos siguen la máquina de estados del backend**
  (`transicionesPermitidas`): despacho y retiro difieren solo en el tercer
  paso. Los textos están en `features/pedidos/estados.ts`.
- **"Pago no completado"** en vez de "Pendiente de pago" cuando el último
  intento falló (`estado_pago = fallido`), para que el comprador sepa que
  tiene que volver a pagar.
- **El detalle se muestra sin esperar los documentos**; la boleta aparece
  cuando llega.

## Pruebas

- Ecommerce (`features/pedidos/pedidos.spec.ts`):
  - Lista: folio, fecha, total, estado, envíos y enlace al detalle.
  - Filtros y páginas: filtro desde la URL y vacío por estado, sin pedidos, y paginación.
  - Detalle: seguimiento por envío, despacho y retiro con su paso actual, y boleta.
  - Pendiente: "Pagar ahora" va a Webpay, sin seguimiento ni documentos.
  - Funciones de pasos y estados.
- En el navegador como El Fogón:
  - La lista de sus 8 órdenes y el filtro "Entregados".
  - El detalle de CM-10005, entregado con despacho y retiro.
  - El pedido pendiente CM-90013 con "Pagar ahora".

## Archivos

- `apps/ecommerce/src/app/features/pedidos/`:
  - `pedidos.component.*` (lista), `pedido.component.*` (detalle)
  - `estados.ts`, `pedidos.spec.ts`
  - `detalle-orden.component.*` (seguimiento)
- `apps/ecommerce/src/app/core/pedidos/pedidos.service.ts`.
- `apps/ecommerce/src/app/app.routes.ts`, `app.component.{html,css}` ("Mis pedidos"), `features/checkout/resultado.component.html` ("Seguir mi pedido").
