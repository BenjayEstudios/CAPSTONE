# KAN-85 — Ecommerce web (cliente y proveedor)

**Estado:** 🔄 En curso · **Responsable:** Benjamín González ·
**App:** `apps/ecommerce`

Aplicación web Angular con dos perfiles en una sola app: el sitio de compra
del cliente (catálogo, comparador, carro multiproveedor, checkout único) y el
panel web del proveedor (ofertas, órdenes de venta, cobertura, perfil,
documentos, liquidaciones).

## Lo que hay hoy

- Tema con los tokens de la identidad (los mismos de admin-site), cabecera con
  la marca y el estado de la sesión.
- Cuenta del comprador (KAN-97): ingresar, registro (persona o empresa),
  recuperar y restablecer contraseña, sesión persistente con JWT, guard de
  sesión e interceptor de 401
  ([entrada](../cambios/2026-11-20-ecommerce-registro-e-ingreso-de-comprador.md)).
- Inicio (KAN-89): buscador, contadores, categorías con conteo, mayor diferencia
  de precio y carro en la cabecera
  ([entrada](../cambios/2026-11-20-ecommerce-inicio.md)).
- Catálogo con filtros y búsqueda (KAN-90, KAN-91)
  ([entrada](../cambios/2026-11-20-ecommerce-catalogo-y-busqueda.md)).
- Ficha de producto con comparador en tabla y lado a lado; Comprar agrega la
  oferta al carro (KAN-92, KAN-93)
  ([entrada](../cambios/2026-11-20-ecommerce-ficha-y-comparador.md)).
- Carro multiproveedor agrupado por distribuidor, con cantidades, avisos de
  precio y stock, despachos y ahorro (KAN-94)
  ([entrada](../cambios/2026-11-20-ecommerce-carro-multiproveedor.md)).
- Checkout único en tres pasos con entrega por distribuidor y pago con
  Webpay Plus; resultado del pago con reintento (KAN-95)
  ([entrada](../cambios/2026-11-20-ecommerce-checkout-con-webpay.md)).
- Confirmación con el detalle consolidado: folio, medio, total, envíos con
  líneas, modalidad y plazo, y boleta/factura y guías en PDF (KAN-96)
  ([entrada](../cambios/2026-11-20-ecommerce-confirmacion-de-compra.md)).
- Mis pedidos: historial con filtros por estado y detalle con el
  seguimiento de cada envío; pagar un pedido pendiente (KAN-98)
  ([entrada](../cambios/2026-11-20-ecommerce-mis-pedidos.md)).
- Calificar al distribuidor de un envío entregado (1 a 5 y comentario), una
  vez; se suma al promedio del comparador (KAN-99)
  ([entrada](../cambios/2026-11-20-calificar-proveedor.md)).
- Proveedor: "Vender en Cotizapp" (`/vender`), solicitud de alta que queda
  en revisión con su caso de moderación (KAN-100)
  ([entrada](../cambios/2026-11-20-registro-de-proveedor.md)).
- Proveedor: panel en `/proveedor` con el dashboard de ventas (KPIs del mes,
  venta semanal, más vendidos, requiere atención) (KAN-101)
  ([entrada](../cambios/2026-11-20-panel-proveedor-dashboard.md)).
- Proveedor: "Asignarme un producto" (`/proveedor/asignar`) con cálculos,
  posición frente a otros y tope de publicación (KAN-102)
  ([entrada](../cambios/2026-11-20-asignarme-un-producto.md)).
- Proveedor: "Mis productos" (`/proveedor/productos`), tabla de ofertas con
  edición de precio y stock, pausar/reactivar e historial (KAN-103)
  ([entrada](../cambios/2026-11-20-mis-productos-publicados.md)).
- Proveedor: "Cómo se compara tu precio" en Mis productos: posición, diferencia
  con el más bajo y precio más bajo por oferta publicada (KAN-104)
  ([entrada](../cambios/2026-11-20-como-se-compara-tu-precio.md)).
- Proveedor: "Órdenes" (`/proveedor/ventas`), sus envíos con filtros por estado
  y el botón para avanzarlos hasta entregado (KAN-105)
  ([entrada](../cambios/2026-11-20-ordenes-de-venta-del-proveedor.md)).
- Proveedor: "Clientes" (`/proveedor/clientes`), quien le compró con su
  recompra; el contacto se libera con la primera orden pagada (KAN-106)
  ([entrada](../cambios/2026-11-20-tus-clientes-del-proveedor.md)).
- Proveedor: "Demanda" (`/proveedor/demanda`), más vistos y clickeados,
  stock restante del mes y clientes potenciales por comuna (KAN-107)
  ([entrada](../cambios/2026-11-20-demanda-y-cobertura-del-proveedor.md)).
- Proveedor: "Perfil de empresa" (`/proveedor/perfil`), datos legales, contacto,
  dirección y bodega, tiempos de despacho, liquidación y estado de la cuenta (KAN-108)
  ([entrada](../cambios/2026-11-20-perfil-de-empresa-del-proveedor.md)).
- Proveedor: "Cobertura" (`/proveedor/cobertura`), zonas de despacho por región o
  comuna y puntos de retiro; el checkout solo ofrece despacho a comunas cubiertas (KAN-109)
  ([entrada](../cambios/2026-11-20-cobertura-y-puntos-de-retiro.md)).
- Proveedor: "Documentos" (`/proveedor/documentos`), subida de carpeta tributaria,
  resolución sanitaria y certificado de vigencia con su estado y revisión (KAN-110)
  ([entrada](../cambios/2026-11-20-documentos-del-proveedor.md)).
- La vista de status quedó en `/estado`. Lint y tests (karma).
- En producción se sirve desde la imagen de Nginx (KAN-158).

## Tickets

### Cliente

| Ticket | Historia | Estado |
|---|---|---|
| KAN-89 | Home del ecommerce | ✅ [entrada](../cambios/2026-11-20-ecommerce-inicio.md) |
| KAN-90 | Catálogo por categoría con filtros | ✅ [entrada](../cambios/2026-11-20-ecommerce-catalogo-y-busqueda.md) |
| KAN-91 | Búsqueda de productos | ✅ [entrada](../cambios/2026-11-20-ecommerce-catalogo-y-busqueda.md) (marca propia como filtro por marca) |
| KAN-92 | Ficha de producto con comparador de proveedores | ✅ [entrada](../cambios/2026-11-20-ecommerce-ficha-y-comparador.md) |
| KAN-93 | Comparación lado a lado | ✅ [entrada](../cambios/2026-11-20-ecommerce-ficha-y-comparador.md) |
| KAN-94 | Carro multiproveedor | ✅ [entrada](../cambios/2026-11-20-ecommerce-carro-multiproveedor.md) |
| KAN-95 | Checkout único | ✅ [entrada](../cambios/2026-11-20-ecommerce-checkout-con-webpay.md) (Webpay; transferencia y línea de crédito pendientes, decisión abierta 16) |
| KAN-96 | Confirmación y detalle de compra consolidado | ✅ [entrada](../cambios/2026-11-20-ecommerce-confirmacion-de-compra.md) |
| KAN-97 | Registro e inicio de sesión de comprador | ✅ [entrada](../cambios/2026-11-20-ecommerce-registro-e-ingreso-de-comprador.md) |
| KAN-98 | Mis pedidos y seguimiento | ✅ [entrada](../cambios/2026-11-20-ecommerce-mis-pedidos.md) |
| KAN-99 | Calificar proveedor tras la entrega | ✅ [entrada](../cambios/2026-11-20-calificar-proveedor.md) |

### Proveedor

| Ticket | Historia | Estado |
|---|---|---|
| KAN-100 | Registro y alta de proveedor | ✅ [entrada](../cambios/2026-11-20-registro-de-proveedor.md) (aprobar aún no cierra el caso de moderación) |
| KAN-101 | Dashboard de ventas | ✅ [entrada](../cambios/2026-11-20-panel-proveedor-dashboard.md) |
| KAN-102 | Asignarme un producto (publicar oferta) | ✅ [entrada](../cambios/2026-11-20-asignarme-un-producto.md) (el tope bloquea publicar) |
| KAN-103 | Mis productos publicados | ✅ [entrada](../cambios/2026-11-20-mis-productos-publicados.md) |
| KAN-104 | Cómo se compara tu precio | ✅ [entrada](../cambios/2026-11-20-como-se-compara-tu-precio.md) |
| KAN-105 | Órdenes de venta | ✅ [entrada](../cambios/2026-11-20-ordenes-de-venta-del-proveedor.md) |
| KAN-106 | Tus clientes | ✅ [entrada](../cambios/2026-11-20-tus-clientes-del-proveedor.md) |
| KAN-107 | Demanda y cobertura (analítica) | ✅ [entrada](../cambios/2026-11-20-demanda-y-cobertura-del-proveedor.md) |
| KAN-108 | Perfil de empresa | ✅ [entrada](../cambios/2026-11-20-perfil-de-empresa-del-proveedor.md) |
| KAN-109 | Cobertura de despacho y puntos de retiro | ✅ [entrada](../cambios/2026-11-20-cobertura-y-puntos-de-retiro.md) |
| KAN-110 | Documentos del proveedor | ✅ [entrada](../cambios/2026-11-20-documentos-del-proveedor.md) |
| KAN-111 | Liquidaciones | ⏳ |

## Dependencias

Casi todo depende de la API (KAN-88): auth (KAN-144), catálogo y comparador
(KAN-145), ofertas (KAN-146), carro y orden (KAN-147), pagos (KAN-148). El
contrato de esos endpoints ya está escrito desde mobile en
[`apps/mobile/API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md); conviene
que ecommerce consuma la misma forma.

## Referencias

Mockups `Mockups/CompraMejor Cliente.html` y `CompraMejor Proveedor.html`;
casos de uso en `CasosDeUsos/`.
