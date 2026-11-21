# KAN-87 — App mobile (cliente y distribuidor)

**Estado:** 🔄 Pantallas completas contra fakes; falta la integración real ·
**Responsable:** Samuel Alarcón · **App:** `apps/mobile`

Una sola app Flutter para los dos perfiles del marketplace: el comprador
(catálogo, comparador, carro, checkout, pedidos) y el distribuidor
(estadísticas, visitas, calificaciones, órdenes, alertas). Navega según el
rol después del login.

## Cerrado

"Cerrado" acá significa: pantallas, estado y tests listos **contra fakes**
(`USE_FAKES=true`, con el seed). Cada feature ya tiene su datasource remoto
con la forma real o especificada; pasa a la API real con `USE_FAKES=false`
cuando el backend tenga el endpoint, sin tocar pantallas.

| Ticket | Historia | Entrada | API |
|---|---|---|---|
| KAN-125 | Estructura base de la app | [estructura base](../cambios/2026-10-23-mobile-estructura-base.md), [rediseño](../cambios/2026-10-23-mobile-rediseno-para-la-demo.md) | — |
| KAN-126 | Login y navegación según perfil | [login](../cambios/2026-10-23-mobile-login-y-navegacion-por-perfil.md) | ⏳ `POST /auth/login` |
| KAN-127 | Home, categorías y búsqueda | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) | ✅ `/categorias` · ⏳ `/catalogo/productos` |
| KAN-128 | Listado con filtros | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) | ⏳ `/catalogo/productos` |
| KAN-129 | Ficha con comparador de proveedores | [catálogo](../cambios/2026-10-23-mobile-catalogo-y-comparador.md) | ⏳ `/catalogo/productos/:id` |
| KAN-130 | Carro multiproveedor | [carro](../cambios/2026-11-18-mobile-carro-multiproveedor.md) | ✅ `/carro` |
| KAN-131 | Checkout y pago | [checkout](../cambios/2026-11-18-mobile-checkout-y-pago.md) | ✅ `/carro/confirmar` · ⏳ opciones de entrega, comunas, pago |
| KAN-132 | Mis pedidos | [pedidos](../cambios/2026-11-18-mobile-mis-pedidos.md) | ✅ `/ordenes` · ⏳ calificar |
| KAN-133 | Estadísticas de venta | [ventas](../cambios/2026-11-18-mobile-estadisticas-de-venta.md) | ⏳ `/estadisticas/proveedor/ventas` |
| KAN-134 | Visitas y conversión | [visitas](../cambios/2026-11-18-mobile-visitas-y-conversion.md) | ✅ `/estadisticas/proveedor`, `/eventos/lote` |
| KAN-135 | Calificaciones recibidas | [reseñas](../cambios/2026-11-18-mobile-calificaciones-recibidas.md) | ⏳ `/calificaciones/recibidas` |
| KAN-136 | Órdenes vigentes | [órdenes](../cambios/2026-11-18-mobile-ordenes-vigentes.md) | ✅ `/ordenes`, `PATCH .../estado` |
| KAN-137 | Alertas que requieren atención | [alertas](../cambios/2026-11-18-mobile-alertas-del-distribuidor.md) | ⏳ `/alertas/proveedor` |
| KAN-138 | Build de release para la demo | [release](../cambios/2026-11-18-mobile-build-de-release.md) | — |

## Pendiente

- **KAN-201, integración con la API real:** `POST /auth/login` ya existe y los
  15 endpoints que usa la app responden con el contrato (verificado el
  2026-11-21, [entrada](../cambios/2026-11-21-mobile-endpoints-verificados-contra-la-api.md)).
  Los datasources remotos y el manejo de 401 ya están en el código. Falta lo
  que exige un entorno que no hay en la máquina de desarrollo: correr la app
  con `USE_FAKES=false` en un emulador, probarla contra QA (droplet) y generar
  el APK de release apuntando a QA.
- **Integración real (texto anterior, del 2026-10):** estaba bloqueada por `POST /auth/login` para clientes y
  proveedores ([decisión abierta 10](../decisiones/DECISIONES-ABIERTAS.md)):
  sin token, ni los endpoints que ya existen se pueden usar desde la app.
- **APK apuntando al API productivo** (criterio de KAN-138): falta el dominio
  de producción y el login. El comando está listo en el
  [README de mobile](../../apps/mobile/README.md#release-kan-138).
- **Pasarela real** (KAN-148): `POST /ordenes/:id/pago` ya existe (Webpay
  Plus, KAN-95) y devuelve `urlPago` y `token`. Falta en la app: abrir Webpay
  enviando `token_ws` (formulario POST o `urlPago?token_ws=`), y que el
  retorno vuelva a la app: hoy el backend redirige al ecommerce
  (`/checkout/resultado`); hay que registrar `cotizapp://` y que el retorno
  sepa a qué app volver.

## Endpoints que espera del backend

Todos en [`apps/mobile/API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md),
con índice de cuáles existen (✅, forma real) y cuáles faltan (⏳,
especificados). Además pide campos aditivos en endpoints existentes:
`porComuna` en `GET /estadisticas/proveedor`, y `puntoRetiro` y
`calificacion` por envío en `GET /ordenes/:id`.

## Decisiones de esta épica

- Una sola app para los dos perfiles, no dos apps (lo pide la épica).
- Los roles internos y las cuentas no activas se rechazan en la app; el
  backend no filtra por rol en el login.
- **Fakes con estado y con las reglas del backend** (`lib/core/fake/`): un
  `FakeBackend` en memoria compartido por todas las features, que porta las
  reglas de `packages/application` (carro, `planificarOrden`, alcance y
  transiciones de órdenes, calificaciones, liquidaciones, estadísticas) y
  devuelve los mismos errores (`code`, `detalle`). Así la demo muestra el
  circuito completo: el comprador paga, el distribuidor despacha, el
  comprador califica, y eso se ve en ventas, reseñas y alertas.
- **Pasarela simulada** mientras no exista KAN-148: el fake devuelve una URL
  `fake://` y la app muestra una pantalla de pago que se puede aprobar o
  rechazar (sin cobro).
- **El carro se completa con el catálogo**: `GET /carro` no trae nombre del
  proveedor, plazo, mínimo ni tarifa; el repositorio los toma de la ficha del
  producto en vez de pedir más campos al backend.
- **Catálogo público en `/catalogo/productos`**, porque `GET /productos` ya
  es el listado de administración
  ([decisión abierta 11](../decisiones/DECISIONES-ABIERTAS.md)).
- **APK de demo firmado con una keystore propia que no se versiona**
  (`android/cotizapp-demo.jks` + `android/key.properties`); sin ella, el
  release se firma con la clave debug.
- Id de aplicación `cl.cotizapp.cotizapp_mobile`.

## Cómo probarla

Recorrido de demo, usuarios y cómo generar el APK en el
[README de mobile](../../apps/mobile/README.md#demo).
