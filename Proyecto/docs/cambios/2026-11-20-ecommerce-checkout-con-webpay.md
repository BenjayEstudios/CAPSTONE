# Ecommerce: checkout único con Webpay

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-95 (avanza KAN-148)

## Qué cambió

`/checkout` dejó de ser una pantalla provisoria. Es el pago único del carro
multiproveedor, como en el mockup del cliente, y cobra con **Webpay Plus** de
Transbank (ambiente de integración).

| Criterio | Cómo |
|---|---|
| Paso 1: quién compra (persona o empresa con factura) | "Persona (boleta) · Empresa (factura)", que manda `requiereFactura`. Nombre, correo y organización salen de la cuenta (ver abajo por qué no se piden) |
| Paso 2: entrega (despacho o retiro), dirección, comuna e indicaciones | Una entrega por distribuidor: "Despacho a domicilio" (costo y plazo) o "Retiro en {bodega}, sin costo" con dirección y horario, según lo que permitan sus ofertas. Dirección guardada u "Otra dirección" con calle, número, depto, comuna (lista de `GET /comunas`) e indicaciones para el repartidor |
| Paso 3: medio de pago (tarjeta, transferencia, línea de crédito 30 días) | Tarjeta de crédito, débito o prepago por Webpay. Transferencia y línea de crédito aparecen como "pronto disponible" ([decisión abierta 16](../decisiones/DECISIONES-ABIERTAS.md)) |
| Resumen "Así llega tu pedido" por proveedor y total a pagar | Una fila por distribuidor con su modalidad, plazo y monto; a la derecha "Total a pagar" con productos, despachos y total, que se recalcula al elegir retiro |
| Redirige a la pasarela y vuelve con el resultado | "Pagar $X" crea la orden, inicia la transacción y envía al comprador a Webpay. Al volver, `/checkout/resultado` muestra "¡Listo! Tu pago fue aprobado" con el folio y el total, o, si se rechazó o anuló, la orden pendiente con "Reintentar el pago" |

### Backend

- `GET /carro/opciones-entrega` y `GET /comunas`: estaban en el contrato y no
  existían (la app móvil usaba su backend falso).
- `POST /ordenes/:id/pago`: crea la transacción en Webpay por el total de la
  orden y guarda el token en `orden.referencia_pasarela`.
- `GET|POST /pagos/webpay/retorno` (público): confirma (commit) la
  transacción, deja la orden pagada o con el pago fallido, audita el
  resultado (código de autorización y últimos 4 dígitos), emite la boleta o
  factura y las guías (`emitirDocumentosOrden`, que estaba esperando este
  punto) y redirige al ecommerce.
- Puerto `PasarelaPago` en domain; adaptadores `WebpayPlus` y
  `PasarelaEnMemoria` (tests) en infrastructure. Variables `WEBPAY_ENTORNO`,
  `WEBPAY_CODIGO_COMERCIO` y `WEBPAY_API_KEY`; en integración, sin
  credenciales, usa las públicas de prueba de Transbank.

## Por qué así

- **Webpay Plus.** Cierra la decisión abierta 3; el motivo está en
  [decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md). Queda detrás de
  un puerto: cambiar de pasarela es otro adaptador.
- **El backend recibe el retorno, no el ecommerce.** Así la confirmación
  (commit) y el cambio de estado no dependen del navegador del comprador, y
  la orden solo queda pagada si el monto autorizado es el total. Un retorno
  repetido no vuelve a confirmar.
- **La orden se crea antes de pagar** (`POST /carro/confirmar`, que ya
  existía): descuenta stock y deja la orden `pendiente_pago`. Si el pago se
  rechaza o se anula, la orden queda para reintentar desde el resultado. Cada
  reintento usa otra orden de compra en Webpay (el folio con un sufijo),
  porque Webpay no acepta repetirla.
- **Los datos de quién compra no se piden.** `POST /carro/confirmar` no los
  recibe: la boleta o factura sale con los datos de la organización. Pedirlos
  sin guardarlos confundiría. Queda anotado en la decisión abierta 16.
- **El despacho del total es una estimación** (tarifa a la comuna de la
  cuenta); si se elige otra dirección el backend calcula el definitivo y
  Webpay muestra el monto final antes de pagar.

## Pruebas

- Application (`pagos.use-cases.test.ts`):
  - Iniciar: monto y orden de compra; el reintento usa sufijo; errores de orden ajena, ya pagada, medio no disponible y proveedor.
  - Retorno: aprobado, rechazado, monto distinto al total, retorno repetido, anulado (solo con el token de la orden), tiempo agotado y pasarela caída.
- Infrastructure (`checkout.repository.test.ts`): opciones de entrega y comunas contra el seed, `registrarResultadoPago` una sola vez, y `WebpayPlus` con un `fetch` falso (cabeceras, cuerpo, rechazo y error HTTP).
- Backend (`routes/pagos/pagos.test.ts`): iniciar exige sesión; retorno por POST (formulario) y GET (anulado) con la redirección al ecommerce; `/comunas` público.
- Ecommerce (`features/checkout/checkout.spec.ts`):
  - Checkout: tres pasos y entregas por distribuidor; pagar con retiro y factura (cuerpo de confirmar, inicio del pago y envío a Webpay); otra dirección; `SIN_COBERTURA`; pago que no inicia; carro con algo por resolver.
  - Resultado: aprobado, rechazado con reintento, y que no confía solo en `?pago=`.
- **Webpay de integración, de punta a punta**, como El Fogón: carro ajustado al stock, retiro en Bodega Quilicura para Los Andes y despacho para los otros dos, total $80.150; pago con la tarjeta de prueba de Transbank; la orden CM-90012 quedó `pagada` con tarjeta, con boleta y tres guías, y el resultado mostró "¡Listo! Tu pago fue aprobado". Después se restauró la base local.
- Hallazgo de la prueba: el ambiente de integración de Transbank (Imperva) responde 403 si el `Origin` del formulario es `http://[::1]:4200`. Con `localhost` funciona; en producción el origen es el dominio.

## Archivos

- `packages/domain`:
  - `services/pasarela-pago.ts`
  - `dtos/orden.dto.ts` (`iniciarPagoSchema`, `retornoWebpaySchema`)
  - `repositories/carro.repository.ts` (`opcionesEntrega`), `orden.repository.ts` (pago), `comuna.repository.ts`
- `packages/application/src/use-cases/`: `pagos.use-cases.ts`, `comunas.use-cases.ts`, `carro.use-cases.ts` (`obtenerOpcionesEntrega`).
- `packages/infrastructure/src`:
  - `pagos/webpay-plus.ts`, `pagos/pasarela-memoria.ts`
  - `repositories/carro.repository.ts`, `orden.repository.ts`, `comuna.repository.ts`
- `apps/backend/src`:
  - `routes/pagos/`, `routes/comunas/`, `routes/carro/index.ts`
  - `lib/pasarela.ts`, `config/env.ts`, `server/app.ts`, `.env.example`
- `apps/ecommerce/src/app`:
  - `core/checkout/checkout.service.ts`, `core/models/checkout.models.ts`
  - `features/checkout/` (checkout y resultado)
  - `features/carro/fichas-del-carro.ts` (compartido con el carro), `app.routes.ts`
  - Se borró `features/pendiente/`: ya no quedan pantallas provisorias.
