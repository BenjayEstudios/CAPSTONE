# KAN-85 — Ecommerce web (cliente y proveedor)

**Estado:** ⏳ Pendiente · **Responsable:** Benjamín González ·
**App:** `apps/ecommerce`

Aplicación web Angular con dos perfiles en una sola app: el sitio de compra
del cliente (catálogo, comparador, carro multiproveedor, checkout único) y el
panel web del proveedor (ofertas, órdenes de venta, cobertura, perfil,
documentos, liquidaciones).

## Lo que hay hoy

- Scaffold Angular 18 con estructura feature-based, cliente API, estado de
  sesión y la vista de status contra `GET /health-check`.
- Lint (angular-eslint) y tests (karma, ChromeHeadless) con specs mínimos —
  aún sin commitear, ver
  [cambios](../cambios/2026-10-23-ci-tests-angular-en-chromeheadless.md).
- En producción se sirve desde la imagen de Nginx (KAN-158).

## Tickets

### Cliente

| Ticket | Historia | Estado |
|---|---|---|
| KAN-89 | Home del ecommerce | ⏳ |
| KAN-90 | Catálogo por categoría con filtros | ⏳ |
| KAN-91 | Búsqueda de productos | ⏳ |
| KAN-92 | Ficha de producto con comparador de proveedores | ⏳ |
| KAN-93 | Comparación lado a lado | ⏳ |
| KAN-94 | Carro multiproveedor | ⏳ |
| KAN-95 | Checkout único | ⏳ |
| KAN-96 | Confirmación y detalle de compra consolidado | ⏳ |
| KAN-97 | Registro e inicio de sesión de comprador | ⏳ |
| KAN-98 | Mis pedidos y seguimiento | ⏳ |
| KAN-99 | Calificar proveedor tras la entrega | ⏳ (modelo de datos listo, KAN-142) |

### Proveedor

| Ticket | Historia | Estado |
|---|---|---|
| KAN-100 | Registro y alta de proveedor | ⏳ |
| KAN-101 | Dashboard de ventas | ⏳ |
| KAN-102 | Asignarme un producto (publicar oferta) | ⏳ |
| KAN-103 | Mis productos publicados | ⏳ |
| KAN-104 | Cómo se compara tu precio | ⏳ |
| KAN-105 | Órdenes de venta | ⏳ |
| KAN-106 | Tus clientes | ⏳ |
| KAN-107 | Demanda y cobertura (analítica) | ⏳ |
| KAN-108 | Perfil de empresa | ⏳ |
| KAN-109 | Cobertura de despacho y puntos de retiro | ⏳ |
| KAN-110 | Documentos del proveedor | ⏳ |
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
