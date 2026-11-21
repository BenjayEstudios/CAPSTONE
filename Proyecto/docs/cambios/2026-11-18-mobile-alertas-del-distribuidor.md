# Mobile: alertas del distribuidor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-137

Pestaña **Alertas** del distribuidor (con badge de cuántas hay):

- **Por cobrar**: total, desglosado en liquidaciones listas para pagar y lo
  entregado que entra en el próximo corte, y la fecha de la próxima
  liquidación (cada martes).
- **Requiere atención**, de lo más grave a lo informativo, con ícono y
  etiqueta (no solo color): documentos vencidos o por vencer, ofertas con
  stock bajo y envíos por despachar (lleva a Órdenes).
- Estado de los documentos.

Con el seed: Los Andes tiene $97.367 por cobrar y stock bajo en leche y posta
negra; Valle Central tiene la resolución sanitaria vencida (15 nov) y un
envío por despachar.

**Contrato**: falta y quedó especificado `GET /alertas/proveedor`. Los
umbrales (20 cajas, 45 días) quedaron como decisión abierta.

**Toca**: `apps/mobile/lib/features/alertas/` (nuevo), `apps/mobile/lib/core/fake/fake_panel_proveedor.dart`,
`apps/mobile/lib/core/router/app_router.dart`, `apps/mobile/test/features/panel/`.
