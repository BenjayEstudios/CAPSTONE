# Mobile: calificaciones recibidas del distribuidor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-135

Pestaña **Reseñas** del distribuidor: promedio grande con estrellas y
cantidad, distribución de puntajes (5 a 1), porcentaje de entregas a tiempo
y la lista de calificaciones con comentario, cliente, folio de la orden y
fecha (la más nueva primero). Las calificaciones que deja el comprador en
Mis pedidos (KAN-132) aparecen acá y en el promedio del comparador del
catálogo.

**Contrato**: falta y quedó especificado `GET /calificaciones/recibidas`
(usa `resumenPorProveedor` y `listarPorProveedor` de KAN-142 más
`entregas_a_tiempo_pct`).

**Toca**: `apps/mobile/lib/features/calificaciones/` (nuevo),
`apps/mobile/lib/features/catalogo/data/catalogo_fake_datasource.dart` (promedio y
stock vivos del `FakeBackend`), `apps/mobile/lib/features/catalogo/presentation/catalogo_providers.dart`,
`apps/mobile/test/features/panel/`.
