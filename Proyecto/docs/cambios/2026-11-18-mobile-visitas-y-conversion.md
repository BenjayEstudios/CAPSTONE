# Mobile: visitas y conversión del distribuidor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-134

Pestaña **Resumen**, vista "Visitas", con los últimos 30 o 90 días:
vistas, clicks y conversión; vistas por día (línea, arrastrar para ver cada
día); vistas, clicks y conversión por producto; y clientes potenciales por
comuna, marcando las que el distribuidor no cubre.

La app del comprador ahora **genera** esos datos: manda `vista_producto` al
abrir una ficha (con su origen), `busqueda` con la cantidad de resultados y
`click_oferta` al agregar una oferta al carro, por `POST /eventos/lote`
(`lib/core/analitica/`). Si falla, se ignora.

**Contrato**: `GET /estadisticas/proveedor` y `POST /eventos/lote` son
reales; se pide el campo aditivo `porComuna` (sin él, la app oculta esa
sección). Los eventos sintéticos del seed van del 1 de septiembre al 22 de
octubre, por eso la vista ofrece 90 días.

**Toca**: `apps/mobile/lib/features/estadisticas/presentation/visitas_view.dart`,
`apps/mobile/lib/core/analitica/analitica.dart` (nuevo),
`apps/mobile/lib/features/catalogo/presentation/{producto_page,listado_page}.dart`,
`apps/mobile/lib/core/fake/fake_panel_proveedor.dart`, `apps/mobile/test/features/panel/`.
