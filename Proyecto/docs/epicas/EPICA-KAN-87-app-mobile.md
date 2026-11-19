# KAN-87 — App mobile (cliente y distribuidor)

**Estado:** 🔄 En curso · **Responsable:** Samuel Alarcón ·
**App:** `apps/mobile`

Una sola app Flutter para los dos perfiles del marketplace: el comprador
(catálogo, comparador, carro, checkout, pedidos) y el distribuidor
(estadísticas, visitas, calificaciones, órdenes, alertas). Navega según el
rol después del login.

## Cerrado

| Ticket | Historia | Entrada |
|---|---|---|
| KAN-125 | Estructura base de la app | [estructura base](../cambios/2026-10-23-mobile-estructura-base.md), [rediseño](../cambios/2026-10-23-mobile-rediseno-para-la-demo.md) |
| KAN-126 | Login y navegación según perfil | [login](../cambios/2026-10-23-mobile-login-y-navegacion-por-perfil.md) |
| KAN-127 | Home, categorías y búsqueda | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) |
| KAN-128 | Listado con filtros | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) |
| KAN-129 | Ficha con comparador de proveedores | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) |

"Cerrado" acá significa: pantallas, estado y tests listos **contra fakes**.
Pasan a la API real cuando el backend implemente su endpoint
(`USE_FAKES=false`), sin tocar las pantallas.

## Pendiente

| Ticket | Historia | Estado |
|---|---|---|
| KAN-130 | [Cliente] Carro multiproveedor | ⏳ Pestaña placeholder |
| KAN-131 | [Cliente] Checkout y pago | ⏳ |
| KAN-132 | [Cliente] Mis pedidos | ⏳ Pestaña placeholder |
| KAN-133 | [Distribuidor] Estadísticas de venta | ⏳ Pestaña placeholder (Resumen) |
| KAN-134 | [Distribuidor] Visitas y conversión | ⏳ |
| KAN-135 | [Distribuidor] Calificaciones recibidas | ⏳ Pestaña placeholder (Reseñas); datos en el seed |
| KAN-136 | [Distribuidor] Órdenes vigentes | ⏳ Pestaña placeholder |
| KAN-137 | [Distribuidor] Alertas que requieren atención | ⏳ Pestaña placeholder |
| KAN-138 | Build de release para la demo | ⏳ |

## Endpoints que espera del backend

Todos especificados en
[`apps/mobile/API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md).
Existen: `GET /health-check`, `GET /categorias`. Pendientes (la app usa
fake): `POST /auth/login`, `GET /productos`, `GET /productos/:id`, y los del
carro, pedidos y panel del distribuidor a medida que se escriban.

## Decisiones de esta épica

- Una sola app para los dos perfiles, no dos apps (lo pide la épica).
- Los roles internos y las cuentas no activas se rechazan en la app; el
  backend no filtra por rol en el login.
- Fakes con el JSON exacto del contrato, para no bloquearse esperando la API.
- Id de aplicación `cl.cotizapp.cotizapp_mobile`.

## Cómo probarla

Recorrido de demo y usuarios en el
[README de mobile](../../apps/mobile/README.md#demo).
