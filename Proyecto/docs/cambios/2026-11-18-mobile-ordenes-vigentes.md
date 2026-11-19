# Mobile: órdenes vigentes del distribuidor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-136

Pestaña **Órdenes** del distribuidor: sus envíos vigentes de órdenes pagadas,
del más antiguo al más nuevo, con folio, cliente, comuna, estado y monto (y
"Recibes $X" descontada la comisión), más un resumen por estado. Cada uno
tiene el botón para el siguiente paso (empezar a preparar, marcar despachado
o listo para retiro, marcar entregado) con confirmación; llama
`PATCH /ordenes/envios/:id/estado`. El detalle muestra qué preparar, dónde
entregar y el desglose de lo que recibe. "Historial" lista lo entregado y
cancelado.

Comprador y distribuidor comparten el `FakeBackend`: una orden pagada en la
demo aparece acá, y avanzarla cambia lo que ve el comprador en Mis pedidos
(test de punta a punta en `ordenes_proveedor_flujo_test.dart`).

**Contrato**: los tres endpoints usados son reales.

**Toca**: `apps/mobile/lib/features/ordenes/presentation/proveedor/` (nuevo),
`apps/mobile/lib/core/router/*`, `apps/mobile/test/features/ordenes/ordenes_proveedor_flujo_test.dart`.
