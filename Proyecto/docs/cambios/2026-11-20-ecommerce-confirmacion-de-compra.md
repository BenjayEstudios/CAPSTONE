# Ecommerce: confirmación y detalle consolidado de la compra

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-96

## Qué cambió

La página adonde vuelve el comprador desde Webpay (`/checkout/resultado`,
KAN-95) ahora muestra el detalle consolidado de la orden, con un componente
reutilizable (`features/pedidos/detalle-orden.component.ts`) que también
servirá para "Mis pedidos" (KAN-98).

| Criterio | Cómo |
|---|---|
| Folio, total pagado y medio de pago | Recuadro con folio (CM-90012), fecha de pago, medio ("Tarjeta (Webpay)") y "Total pagado" |
| Detalle por envío/proveedor: líneas, plazo y modalidad | Un bloque por distribuidor: estado del envío; "Despacho a domicilio" con la dirección y las indicaciones, o "Retiro en {punto}" con su dirección y horario; plazo y fecha estimada ("Llega a más tardar el sábado 21 de noviembre", contada desde el pago); tabla de productos con cajas, precio y total; productos, despacho y total del distribuidor |
| Enlace a los documentos tributarios cuando estén disponibles | "Boleta electrónica N.º 1 (PDF)" (o factura) en el resumen y "Guía de despacho N.º … (PDF)" en cada envío. El PDF se pide con el token y se abre en otra pestaña. Sin documentos: "Tu boleta aparecerá aquí apenas se emita" |
| Pago fallido con opción de reintentar | Ya venía de KAN-95: "El pago fue rechazado" / "Anulaste el pago" con "Reintentar el pago"; ahora debajo se ve el detalle de lo que se va a pagar y "La boleta se emite cuando se confirma el pago" |

### API (`GET /ordenes/:id`, aditivo)

`envios[].puntoRetiro: { id, nombre, horario, direccion } | null` en el
detalle (no en el listado). Era un campo que la app móvil ya pedía en el
contrato; antes solo venía `puntoRetiroId`.

## Por qué así

- **Un componente para el detalle**: la confirmación y "Mis pedidos" (KAN-98)
  muestran lo mismo; así se hace una vez.
- **El PDF no es un enlace directo**: `GET /documentos-tributarios/:id/pdf`
  exige el token, así que se descarga con el `HttpClient` (el interceptor
  agrega el token) y se abre como blob.
- **La fecha estimada solo existe si hay pago**: el plazo corre desde que se
  paga; en una orden pendiente se dice eso en vez de inventar una fecha.
- **Nombres legibles de los documentos** en el ecommerce ("Boleta electrónica",
  "Guía de despacho"); el backend los entrega en mayúsculas para el PDF.

## Pruebas

- Ecommerce:
  - `features/pedidos/detalle-orden.spec.ts`: resumen con folio, medio, total y boleta; por distribuidor la dirección o el punto de retiro, plazo, estado, líneas, montos y guía; orden sin pago; abrir el PDF como blob; helpers.
  - `checkout.spec.ts`: el resultado aprobado muestra la boleta.
- Infrastructure (`checkout.repository.test.ts`): el envío con retiro trae su punto en el detalle; el despacho trae `null`; el listado no lo trae.
- En el navegador como El Fogón:
  - La orden CM-10007 (despacho de Valle Central y retiro en Planta Renca), con documentos emitidos para la prueba y borrados después. El PDF de la boleta se abre.
  - La orden CM-90014 con pago rechazado, con reintento y detalle.

## Archivos

- `packages/domain/src/repositories/orden.repository.ts` (`PuntoRetiroInfo`), `packages/infrastructure/src/repositories/orden.repository.ts`, `packages/application/src/use-cases/ordenes.use-cases.ts`.
- `apps/ecommerce/src/app/features/pedidos/` (componente, plantilla, estilos y spec).
- `apps/ecommerce/src/app/features/checkout/resultado.component.{ts,html}`, `core/checkout/checkout.service.ts` (`documentos`, `pdf`), `core/api/api.client.ts` (`getBlob`), `core/models/checkout.models.ts`.
