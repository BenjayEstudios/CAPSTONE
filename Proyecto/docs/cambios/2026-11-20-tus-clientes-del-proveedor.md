# Panel del proveedor: tus clientes

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-106

## Qué cambió

Nueva pestaña **"Clientes"** en el panel del proveedor (`/proveedor/clientes`):
quien le compró al menos una vez, de quien más compró a quien menos, como en
el mockup del proveedor.

| Criterio | Cómo |
|---|---|
| Columnas: cliente, tipo, comuna, órdenes, monto comprado, última compra, recompra | Cliente = nombre de fantasía de la organización compradora (o su razón social), con el contacto debajo. Tipo = empresa, persona o institución (ver abajo). Comuna = la de la dirección de la organización o, si no tiene, la de su última entrega con este proveedor. Órdenes = órdenes pagadas, con "+1 por pagar" si tiene alguna esperando pago. Comprado = suma de los envíos no cancelados del proveedor en esas órdenes. Última compra = fecha de pago más reciente. Recompra = cada cuánto vuelve (ver abajo) |
| Los datos de contacto se liberan solo después de la primera orden pagada | La lista incluye a quien tiene una orden esperando pago (sin pago fallido), pero el backend devuelve `contacto: null` hasta su primera orden pagada: no viajan email, teléfono, razón social ni RUT. En pantalla dice "Contacto disponible con su primera orden pagada" |

**Recompra:** el intervalo promedio entre la primera y la última compra pagada.
Hasta 10 días es "Semanal", hasta 20 "Quincenal" y hasta 45 "Mensual"; más
que eso, "Esporádica". Con una sola compra es "Primera vez", y sin compras
pagadas, "Por pagar".

**Tipo de cliente:** `organizacion` no lo guarda. Se deduce del RUT y del
giro: RUT de 60 a 69 millones = institución; RUT de persona sin giro =
persona; el resto, empresa. Quedó como
[decisión abierta #17](../decisiones/DECISIONES-ABIERTAS.md).

### API

- `GET /proveedor/clientes?pagina=&tamano=` (nuevo): ver la sección "Tus
  clientes" del README del backend.

## Por qué así

- **El contacto se filtra en el backend**, no en la pantalla: si la regla
  viviera solo en Angular, el email y el RUT viajarían igual en la respuesta.
- **Se listan los que tienen una orden esperando pago**: es el único caso en
  que la regla del contacto se nota, y el proveedor sabe que hay un cliente en
  camino. Una orden con pago fallido no cuenta.
- **Solo las órdenes con un envío del proveedor**: lo que el cliente le compró
  a otros no se ve, igual que en "Órdenes" (KAN-105).
- **Recompra por el intervalo promedio** (primera y última compra, y el
  número de órdenes) en vez de las fechas de todas las órdenes: sale de la
  misma consulta agregada y basta para las categorías del mockup.
- **Sin "Ver ficha"**: el mockup tiene el botón pero el ticket no pide la
  ficha del cliente; queda para cuando se defina qué muestra.

## Corrección: test del dashboard del proveedor

El test de KAN-101 (`dashboard.spec.ts`) fallaba desde las 00:00 UTC del 21 de
noviembre. Fijaba la fecha reemplazando `hoy` después de crear el componente,
y para entonces `rangos` (un `computed`) ya había guardado la fecha real.
Ahora la fecha viene de un token (`RELOJ`) que el test provee antes de crear
el componente. Así el test ya no depende del día en que corre.

## Pruebas

- Application (`ordenes.use-cases.test.ts`):
  - El contacto sale solo con órdenes pagadas, y sin ellas no viaja el email ni el RUT.
  - Un usuario que no es proveedor recibe 403.
  - El tipo de cliente según RUT y giro.
  - La recompra por intervalo.
- Infrastructure (`checkout.repository.test.ts`):
  - Órdenes, pendientes y monto por cliente coinciden con un SQL directo.
  - Orden por monto, comuna, fechas y paginación.
- Backend (`routes/ordenes/ordenes.test.ts`): 401 sin token, 403 al cliente y, sin orden pagada, el body no trae el email.
- Ecommerce (`features/proveedor/clientes.spec.ts`):
  - Columnas y valores.
  - El contacto oculto y "+1 por pagar".
  - "Ver más".
  - El RUT con puntos y los tonos.
- En el navegador (Chrome) como Valle Central:
  - Aparecen Dulce Hogar y El Fogón, ambos "Quincenal", El Fogón con "+1 por pagar".
  - CM-90013 se pasó por un rato a La Marraqueta, que no tiene órdenes pagadas. Apareció con el contacto oculto, la comuna de su entrega y "Por pagar".
  - Después se devolvió la orden a El Fogón.

## Archivos

- `packages/domain/src/dtos/orden.dto.ts` (`listarClientesQuerySchema`), `repositories/orden.repository.ts` (`ClienteDeProveedor`, `clientesDeProveedor`).
- `packages/application/src/use-cases/ordenes.use-cases.ts` (`listarClientes`, `tipoCliente`, `frecuenciaRecompra`) y su test.
- `packages/infrastructure/src/repositories/orden.repository.ts`; `test/checkout.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts` (`GET /proveedor/clientes`), `routes/ordenes/ordenes.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/clientes.component.*`, `clientes.spec.ts`, `panel-proveedor.component.ts` (pestaña), `dashboard.component.ts` y `dashboard.spec.ts` (`RELOJ`), `core/proveedor/ventas-proveedor.service.ts`, `app.routes.ts`.
- `docs/decisiones/DECISIONES-ABIERTAS.md` (#17).
