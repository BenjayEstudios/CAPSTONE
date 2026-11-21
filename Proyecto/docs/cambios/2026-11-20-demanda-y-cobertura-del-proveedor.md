# Panel del proveedor: demanda y cobertura

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-107

## Qué cambió

Nueva pestaña **"Demanda"** en el panel del proveedor (`/proveedor/demanda`):
qué miran los clientes, dónde están y cuánto stock queda, en tres bloques como
en el mockup. Muestra los últimos 30 días, con un botón para ver los últimos 90.

| Criterio | Cómo |
|---|---|
| Más vistos y más clickeados: vistas, clicks, conversión y cajas vendidas | Una fila por oferta, de la más vista a la menos. **Vistas** = visitas a la ficha del producto (`vista_producto`). **Clicks** = el cliente abrió esta oferta en la ficha (`click_oferta`). **Conversión** = clicks / vistas, con un tope de 100 %, porque un cliente puede abrir la misma oferta varias veces en una visita. **Cajas vendidas** = cajas de esa oferta en envíos no cancelados de órdenes pagadas del período, con la misma regla de venta que el dashboard. Las conversiones de 22 % o más se destacan, como en el mockup |
| Productos restantes: stock actual sobre las cajas iniciales del mes | Una barra por oferta publicada, de la que le queda menos a la que más ("0 de 39 cajas · 0 %"). Las cajas del inicio del mes salen del último cambio de stock anterior al día 1 en `oferta_precio_historial`. Si la oferta es nueva o no tiene historial, salen de sus cajas iniciales. Bajo el 20 % la barra va en magenta |
| Clientes potenciales por ubicación (vieron y compraron a otro proveedor) | Organizaciones cuyos usuarios, con la sesión iniciada, vieron un producto que el proveedor ofrece y en el período se lo compraron a otro proveedor. Se agrupan por la comuna donde recibieron esa orden (o la de la organización, si fue retiro). Cada comuna dice "Despachas" o "Sin cobertura", según `proveedor_cobertura` (por comuna o por región) |

### API

- `GET /proveedor/demanda?desde&hasta` (nuevo): ver "Demanda y cobertura" en
  el README del backend.
- `AnaliticaRepository.embudoPorProducto` agrega `ofertaId`, `formato`,
  `estadoOferta` y `cajasVendidas` (aditivo); nuevos `stockDelMes` y
  `potencialesPorComuna`.

## Por qué así

- **Por comuna y no por región**: la cobertura del proveedor se define también
  por comuna, y los compradores de la demo están todos en la Región
  Metropolitana, donde una fila por región no diría nada.
- **Solo vistas con sesión iniciada** para los potenciales: una vista anónima
  no se puede ligar a una compra. Por eso el número es un piso, no el total.
- **La conversión es clicks / vistas**, como en el mockup ("Click = el cliente
  abrió tu oferta"). El tope de 100 % evita cifras como "125 %" cuando hay
  pocas vistas y alguien abrió la oferta dos veces.
- **Inicio del mes desde el historial** de KAN-103 y KAN-146: es la única
  forma de saber cuántas cajas había el día 1 sin guardar fotos del stock.
- **Botón de 90 días**: el criterio pide 30 días y es lo que se ve por
  defecto, pero los datos de la demo terminan en octubre. Con 30 días la
  pantalla queda casi vacía, y el aviso ofrece mirar 90.
- **Permiso `publicar_precio_stock`** (como `/proveedor/cobertura`): solo una
  cuenta de proveedor la ve, y la organización sale del token.

## Pruebas

- Application (`panel-proveedor.use-cases.test.ts`):
  - Rango de 30 días por defecto, e inicio del mes.
  - Orden por vistas, sin borradores sin actividad, y la conversión con tope.
  - Stock ordenado por lo que queda.
  - Potenciales por clientes.
  - 403 sin organización.
- Infrastructure (`analitica.repository.test.ts`):
  - Las cajas vendidas por producto suman lo mismo que `ventasPorProducto`.
  - Las cajas del inicio del mes se toman del último cambio anterior al mes; se ignora uno posterior.
  - Potenciales de Los Andes: Las Condes y Ñuñoa, con cobertura. Las Palmas no cubre esas comunas. Sin usuario en sus eventos, Dulce Hogar deja de contar.
- Backend (`routes/ordenes/ordenes.test.ts`): 401, 403 sin permiso de proveedor, los tres bloques y 400 con un rango de más de 366 días.
- Ecommerce (`features/proveedor/demanda.spec.ts`):
  - Tabla con conversión destacada.
  - Barras de stock y de potenciales, con su cobertura.
  - Sin actividad en 30 días, el botón para mirar 90.
  - Cálculos de fecha, porcentaje y ancho.
- En el navegador (Chrome) como Los Andes:
  - Con 30 días aparecen las visitas recientes; la leche con 4 vistas y 5 clicks queda en 100 %.
  - Con 90 días: aceite 173 vistas, 48 clicks, 27,7 % y 12 cajas.
  - La leche aparece con 0 de 39 cajas.
  - Potenciales en Las Condes y Ñuñoa, ambas con "Despachas".

## Archivos

- `packages/domain/src/entities/analitica.entity.ts` (`EmbudoProducto`, `StockDelMes`, `PotencialesComuna`), `repositories/analitica.repository.ts`.
- `packages/application/src/use-cases/panel-proveedor.use-cases.ts` (`demandaProveedor`, `conversionClicks`, `porcentajeRestante`) y su test.
- `packages/infrastructure/src/repositories/analitica.repository.ts`; `test/analitica.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts` (`GET /proveedor/demanda`), `routes/ordenes/ordenes.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/demanda.component.*`, `demanda.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/panel-proveedor.service.ts`, `core/reloj.ts` (el token `RELOJ`, movido desde el dashboard), `dashboard.component.ts`, `dashboard.spec.ts`, `app.routes.ts`.
