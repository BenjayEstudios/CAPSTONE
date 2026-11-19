# Mobile: mis pedidos

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-132

Pestaña **Pedidos** del comprador:

- Lista de órdenes (`GET /ordenes`) con folio, fecha, proveedores, medio de
  pago, total y estado. Las pendientes de pago tienen "Pagar ahora".
- Detalle (`GET /ordenes/:id`): totales, dirección y un bloque por envío
  con modalidad (despacho o retiro con dirección y horario), seguimiento
  de estados (por despachar → en preparación → despachado o listo para retiro
  → entregado), líneas y montos.
- **Calificar al proveedor** cuando el envío está entregado: 1 a 5
  estrellas y comentario. Después muestra "Tu calificación".

Feature compartida `ordenes` (dominio y datos) para el comprador y para el
distribuidor (KAN-136): es el mismo endpoint, que presenta distinto según el
perfil.

**Contrato**: `GET /ordenes` y `GET /ordenes/:id` son reales. Falta y quedó
especificado `POST /ordenes/envios/:id/calificacion` (el repositorio de
KAN-142 ya existe), más dos campos aditivos en `GET /ordenes/:id`:
`envios[].puntoRetiro` y `envios[].calificacion`.

**Toca**: `apps/mobile/lib/features/ordenes/` (nuevo: dominio, datos y
`presentation/cliente/`), `apps/mobile/lib/core/router/*`, `apps/mobile/test/features/ordenes/`.
