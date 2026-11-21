# Mobile: checkout y pago

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-131

Checkout en tres pasos, como el mockup ClienteMovil:

1. **Quién compra**: persona o empresa (empresa = factura, exige RUT
   válido por módulo 11), nombre y correo.
2. **Entrega**: por proveedor, despacho o retiro en su bodega (solo si tiene
   punto de retiro y ninguna oferta es "solo despacho", la regla de
   `RETIRO_NO_DISPONIBLE`); dirección guardada u otra (calle, número,
   comuna).
3. **Pago**: tarjeta, transferencia o línea de crédito (solo empresas).

"Así llega tu pedido" resume cada envío con su modalidad y montos. "Pagar"
llama `POST /carro/confirmar` (orden `pendiente_pago`, folio `CM-9xxxx`),
pide la URL de pago y abre la pasarela. Vuelve a una pantalla de resultado
con el folio y el reparto por proveedor, o con "Reintentar pago" si se
rechazó. Los 409 del backend (`PRECIO_CAMBIO`, `SIN_STOCK`,
`SIN_COBERTURA`...) se explican en español y, si se arreglan en el carro,
llevan de vuelta a él.

**Pago simulado**: la pasarela (KAN-148) no existe. Con `USE_FAKES=true`,
`POST /ordenes/:id/pago` del fake devuelve una URL `fake://` y la app
muestra una pasarela simulada (aprobar o rechazar, sin cobro). Contra la API
real la app abre `urlPago` en el navegador (`url_launcher`) y, al volver,
relee la orden. Si la API todavía no tiene el endpoint, la orden queda
creada y pendiente de pago, y se puede pagar después desde Mis pedidos.

**Contrato**: `POST /carro/confirmar` es real. Faltan y quedaron
especificados `GET /carro/opciones-entrega` (direcciones y puntos de
retiro), `GET /comunas` y `POST /ordenes/:id/pago`.

**Toca**: `apps/mobile/lib/features/checkout/` (nuevo), `apps/mobile/lib/core/format/rut.dart`,
`apps/mobile/lib/core/router/*`, `apps/mobile/pubspec.yaml` (`url_launcher`),
`apps/mobile/android/app/src/main/AndroidManifest.xml` (consulta de intents `https`),
`apps/mobile/test/features/checkout/`, `apps/mobile/test/core/rut_test.dart`.
