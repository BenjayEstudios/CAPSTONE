# Panel del proveedor: órdenes de venta

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-105

## Qué cambió

Nueva pestaña **"Órdenes"** en el panel del proveedor (`/proveedor/ventas`):
los envíos que le tocan, uno por orden, como en el mockup del proveedor.

| Criterio | Cómo |
|---|---|
| Lista de envíos: folio, cliente, comuna, fecha, líneas, cajas, monto, estado | Una tabla con esas ocho columnas. Cliente = nombre de fantasía de la organización compradora. Comuna = la de la dirección de entrega o la del punto de retiro, con "Despacho" o "Retiro en bodega" debajo. Fecha = pago de la orden. Monto = subtotal del envío + su despacho. De a 50, con "Ver más" |
| Filtros por estado | Chips con el conteo de cada estado ("Por despachar 1", "Entregados 5"); solo aparecen los estados que tienen envíos. El título resume "7 órdenes · 1 por despachar" |
| Avanzar el estado: en preparación → despachado/listo para retiro → entregado | Un botón por fila con el siguiente paso: "Preparar", "Marcar despachado" o "Marcar listo para retiro" según la modalidad, y "Marcar entregado". Usa la máquina de estados que ya existía (`PATCH /ordenes/envios/:id/estado`, KAN-149), que recalcula el estado de la orden y la puntualidad del proveedor y deja auditoría |
| El proveedor solo ve su tramo, nunca la orden completa | El endpoint filtra por la organización del token y solo devuelve los datos del envío: sus líneas, sus cajas y su monto. En una orden con dos proveedores, Los Andes ve $105.400 de una orden de $153.050 |

### API

- `GET /proveedor/ventas?estado=&pagina=&tamano=` (nuevo): ver la sección
  "Ordenes de venta del proveedor" del README del backend. Además de las filas,
  trae `conteo` por estado y, en cada fila, `siguiente` (el próximo estado, o
  `null`).

## Por qué así

- **Un endpoint propio en vez de `GET /ordenes`**: ese listado devuelve la
  orden con sus envíos y sin líneas (lo usan el comprador, el admin y la app
  móvil). La tabla del proveedor necesita una fila por envío con líneas y
  cajas, y el conteo por estado para los filtros. Agregarlo a `/ordenes`
  habría cargado a todos con datos que solo usa esta pantalla.
- **Solo órdenes pagadas**: una orden en `pendiente_pago` todavía puede no
  pagarse, y el backend ya rechaza moverla (`409 ORDEN_NO_PAGADA`). Mostrarla
  sería invitar a preparar algo que quizá no se venda.
- **El botón trae el paso siguiente desde el backend** (`siguiente`): así la
  regla de qué estado sigue vive en un solo lugar
  (`transicionesPermitidas`), y una orden reembolsada no ofrece botón.
- **Sin "Cancelar" en la tabla**: el ticket pide avanzar hacia la entrega.
  Cancelar un envío pagado implica reembolso y se hace desde administración.
- **Tras cada cambio se recarga la lista**: cambian el estado de la fila y los
  conteos. Si otro usuario ya movió el envío (`409 TRANSICION_INVALIDA`), la
  fila lo dice y la lista se actualiza.

## Pruebas

- Application (`ordenes.use-cases.test.ts`): el proveedor recibe solo sus
  envíos con el siguiente paso y el filtro llega al repositorio; un cliente o
  un admin reciben 403 y un estado desconocido 400; el siguiente paso por
  modalidad, y ninguno al final ni si la orden se reembolsó.
- Infrastructure (`checkout.repository.test.ts`): líneas, cajas, monto, comuna
  y estado coinciden con un SQL directo; sin órdenes `pendiente_pago`; el
  filtro y el conteo cuadran.
- Backend (`routes/ordenes/ordenes.test.ts`): 401 sin token, 403 al cliente,
  200 al proveedor con `siguiente`, 400 con un estado inválido.
- Ecommerce (`features/proveedor/ventas.spec.ts`):
  - Tabla y valores.
  - Filtros con conteo.
  - Avanzar el estado y recargar.
  - Un 409 avisado en la fila.
  - Textos de los botones.
- En el navegador (Chrome) como Los Andes:
  - CM-10009 se dejó por despachar.
  - Se llevó con los botones a en preparación, despachado y entregado; la orden quedó entregada y quedaron las filas de auditoría.
  - Se probó el filtro "Listos para retiro".
  - Después se restauraron el envío, la orden, la puntualidad del proveedor y la auditoría.

## Archivos

- `packages/domain/src/dtos/orden.dto.ts` (`listarVentasQuerySchema`), `repositories/orden.repository.ts` (`VentaProveedor`, `ventasDeProveedor`).
- `packages/application/src/use-cases/ordenes.use-cases.ts` (`listarVentas`, `siguienteEstadoEnvio`) y su test.
- `packages/infrastructure/src/repositories/orden.repository.ts`; `test/checkout.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts` (`GET /proveedor/ventas`), `routes/ordenes/ordenes.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/ventas.component.*`, `ventas.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/ventas-proveedor.service.ts`, `app.routes.ts`.
