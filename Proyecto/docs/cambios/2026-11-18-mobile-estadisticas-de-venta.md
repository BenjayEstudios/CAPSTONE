# Mobile: estadísticas de venta del distribuidor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-133

Pestaña **Resumen** del distribuidor, vista "Ventas":

- KPIs del mes elegido (actual o los dos anteriores) contra el mes anterior:
  ventas, neto que recibe, envíos y ticket promedio, con variación con
  flecha y signo. El mes en curso se compara contra **el mismo tramo** del
  anterior ("Cifras al 18 de noviembre, comparadas con el mismo tramo de
  octubre"), como el mockup del proveedor.
- Venta semanal de las últimas 12 semanas (columnas, tocar una muestra el
  detalle; vista de tabla).
- Productos más vendidos en el mismo período.

Gráficos propios en `lib/core/widgets/graficos.dart` (sin librerías),
siguiendo la guía de visualización: una serie por gráfico en el cian de la
marca (validado contra el fondo; el amarillo no pasa el contraste y queda
solo para estrellas), marcas finas, grilla tenue, rótulo solo en el máximo
y detalle al tocar.

**Contrato**: falta y quedó especificado
`GET /estadisticas/proveedor/ventas?desde&hasta`. Solo hay que exponer
`ventasPorSemana` y `ventasPorProducto` de `AnaliticaRepository` (KAN-143),
que ya existen; el fake usa la misma regla (envío no cancelado de orden
pagada, por fecha de la orden).

**Toca**: `apps/mobile/lib/features/estadisticas/` (nuevo), `apps/mobile/lib/core/widgets/graficos.dart`,
`apps/mobile/lib/core/fake/fake_panel_proveedor.dart`, `apps/mobile/lib/core/fake/fake_providers.dart`
(reloj inyectable), `apps/mobile/test/features/panel/`.
