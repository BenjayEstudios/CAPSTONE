# Panel del proveedor: liquidaciones

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-111

## Qué cambió

Nueva pestaña **"Liquidaciones"** en el panel del proveedor
(`/proveedor/liquidaciones`): cuánto le debe Cotizapp y sus cortes semanales.

| Criterio | Cómo |
|---|---|
| Monto "Por cobrar" de lo entregado no liquidado | Arriba, "Por cobrar" con su desglose: entregado aún sin liquidar más las liquidaciones por pagar, y la próxima liquidación ("martes, 24 de noviembre"). Usa el `porCobrar` que ya calculaba `GET /alertas/proveedor` (KAN-101), así que el dashboard y esta pantalla muestran el mismo número |
| Lista de liquidaciones (período, bruto, comisión, neto, estado, fecha de pago) | Tabla con período ("12 al 18 oct", "28 sept al 4 oct"), bruto, comisión (con signo menos), neto, estado ("Por pagar" o "Pagada") y fecha de pago. Se cargan de a 20, con "Ver más". Sale de `GET /liquidaciones/mias`, que ya existía (KAN-152) |
| Detalle de cada liquidación con los envíos incluidos | "Ver envíos" abre la fila con los envíos de esa liquidación: orden, fecha de entrega, bruto, comisión y neto, más el total. Usa un endpoint nuevo, `GET /liquidaciones/mias/:id` |

### API

- `GET /liquidaciones/mias/:id` (nuevo, `ver_ordenes_propias`, organización
  proveedora): el detalle de una liquidación propia con sus envíos. Una de
  otro proveedor o inexistente responde 404; un usuario que no es proveedor,
  403.

## Por qué así

- **Un endpoint propio para el detalle**: `GET /liquidaciones/:id` es del
  admin (`liquidar_proveedor`) y no revisa de quién es la liquidación. El
  nuevo aplica la misma regla que `/liquidaciones/mias`: la organización sale
  del token.
- **"Por cobrar" reusa el cálculo del panel** en vez de repetirlo: así el
  número no puede diferir entre el dashboard y las liquidaciones.
- **La lógica de liquidar no cambia**: el job semanal (`pnpm
  job:liquidaciones`, martes) y el pago los sigue haciendo el admin (KAN-152).
  Esta pantalla solo los muestra.

## Pruebas

- Application (`liquidaciones.use-cases.test.ts`): el proveedor ve la suya con sus envíos; la de otro proveedor o una inexistente da 404; un cliente 403; sin sesión 401.
- Backend (`routes/liquidaciones/liquidaciones.test.ts`): `GET /liquidaciones/mias/:id` da 200 con la propia, 404 con la ajena o inexistente, 403 sin ser proveedor y 401 sin token.
- Ecommerce (`features/proveedor/liquidaciones.spec.ts`):
  - "Por cobrar" con desglose y próxima liquidación.
  - La lista con sus seis columnas.
  - El detalle con los envíos y el total, que se abre y se cierra.
  - "Ver más".
  - Textos de período y fecha.
- En el navegador (Chrome) como Los Andes, solo lectura:
  - "Por cobrar" $97.367 (la liquidación del 12 al 18 oct, por pagar).
  - Las otras cinco pagadas, con su fecha.
  - Al abrir la primera aparece el envío de CM-10009: $105.400 − $8.033 = $97.367.

## Archivos

- `packages/application/src/use-cases/liquidaciones.use-cases.ts` (`obtenerMiLiquidacion`) y su test.
- `apps/backend/src/routes/liquidaciones/index.ts`, `liquidaciones.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/liquidaciones.component.*`, `liquidaciones.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/panel-proveedor.service.ts`, `app.routes.ts`.
