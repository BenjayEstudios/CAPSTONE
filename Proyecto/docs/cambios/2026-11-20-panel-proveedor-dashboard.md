# Panel del proveedor: dashboard de ventas

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-101 (expone lo que pedían KAN-133 y KAN-137)

## Qué cambió

El distribuidor tiene su panel en el ecommerce: `/proveedor`, con la franja
"Panel de proveedor · {empresa} · Cuenta verificada" y pestañas como en el
mockup. Por ahora la única pestaña es **Panel**; cada historia siguiente
(KAN-102 a KAN-111) agrega la suya. Al ingresar sin destino, un proveedor
llega al panel, y en la cabecera ve "Mi panel" en vez del carro.

| Criterio | Cómo |
|---|---|
| KPIs del mes comparados con el mismo tramo del mes anterior | "Ventas de noviembre · cifras al 20 de noviembre, comparadas con el mismo tramo de octubre": Venta del mes y Ticket promedio con su variación ("+14 % vs. octubre"), Por despachar (envíos de órdenes pagadas) y Productos publicados (con los borradores). El tramo anterior va del 1 al mismo día, acotado al largo del mes |
| Gráfico de venta semanal de las últimas 12 semanas | Barras por semana (S36 … "Esta"), en miles de pesos, con la semana actual resaltada, tooltip por barra (semana, desde qué día, monto y envíos) y una tabla oculta para lectores de pantalla. Una serie: sin leyenda. Colores validados con el validador de paletas (contraste y daltonismo) |
| Productos más vendidos (cajas y monto) | Los 5 primeros de las 12 semanas, con cajas y monto |
| Bloque "Requiere atención" | Documentos vencidos, por vencer (45 días o menos), rechazados o que faltan; ofertas con stock bajo (20 cajas o menos; sin stock en urgente); envíos pagados por despachar; ofertas en borrador; y lo por cobrar con la próxima liquidación (martes). Si no hay nada: "Todo al día" |

### API (nueva, la usa también la app móvil)

- `GET /estadisticas/proveedor/ventas?desde&hasta`: totales, una fila por
  semana (lunes, con ceros) y los productos más vendidos. Expone
  `ventasPorSemana` y `ventasPorProducto` (KAN-143), como pedía el contrato
  de KAN-133.
- `GET /alertas/proveedor`: la forma del contrato de KAN-137, más dos
  aditivos:
  - `documentos[].revision`, y `estado: "falta"` para los documentos obligatorios no subidos.
  - `ofertas: { publicadas, borradores }`.
- Nuevo `AnaliticaRepository.pendientesProveedor` (cuatro consultas por proveedor).

## Por qué así

- **Tres llamadas a ventas + una de alertas**, como ya planeaba la app
  móvil: el mes, el tramo anterior y las 12 semanas usan el mismo endpoint
  con distinto rango, sin un endpoint "de dashboard" a la medida.
- **Umbrales 20 cajas y 45 días** como propone la decisión abierta 13; están
  en constantes (`UMBRAL_STOCK_BAJO`, `DIAS_POR_VENCER`) para cambiarlos en
  un lugar si se decide otra cosa.
- **La vigencia del documento se calcula al consultar**, no se lee la columna
  `estado` del seed, que puede estar desactualizada.
- **El panel vive en el mismo ecommerce** (decisión cerrada: una app web para
  cliente y proveedor), con su propio guard (`proveedorGuard`).

## Pruebas

- Application (`panel-proveedor.use-cases.test.ts`): totales y rango de ventas; alertas con documentos vencidos, por vencer y faltantes; stock, cobro, envíos y ofertas; vigencia en el borde de 45 días; próximo martes.
- Infrastructure (`checkout.repository.test.ts`): `pendientesProveedor` coincide con contar directo en SQL.
- Ecommerce (`features/proveedor/dashboard.spec.ts`):
  - Rangos de fechas, incluido el corte de febrero; semana ISO; textos de variación.
  - "Requiere atención" completo.
  - La pantalla pide los cuatro rangos y muestra KPIs, 12 barras con la actual resaltada, la tabla accesible, el top y los avisos.
- En el navegador (Chrome) como Los Andes:
  - Ingreso que lleva al panel.
  - KPIs del mes en $0, porque el seed no tiene ventas de noviembre.
  - Las barras de septiembre y octubre con su tooltip.
  - El top con aceite vegetal (12 cajas, $149.880) y la lista de avisos.
  - Sin scroll horizontal.

## Archivos

- `packages/domain`: `entities/analitica.entity.ts` (`PendientesProveedor`), `repositories/analitica.repository.ts`.
- `packages/application/src/use-cases/panel-proveedor.use-cases.ts`.
- `packages/infrastructure/src/repositories/analitica.repository.ts` (`pendientesProveedor`).
- `apps/backend/src/routes/estadisticas/index.ts` (ventas), `routes/alertas/index.ts`.
- `apps/ecommerce/src/app/features/proveedor/` (marco del panel, dashboard, cálculos y spec), `core/proveedor/panel-proveedor.service.ts`, `core/auth/guards.ts` (`proveedorGuard`), `app.routes.ts`, `app.component.html` ("Mi panel"), `features/cuenta/ingresar.component.ts`.
