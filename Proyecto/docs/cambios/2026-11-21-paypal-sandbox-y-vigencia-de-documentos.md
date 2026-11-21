# Pago con PayPal (sandbox) y job de vigencia de documentos

**Fecha:** 2026-11-21 · **Épica:** KAN-88 · **Tickets:** KAN-148, KAN-150

## Qué cambió

### Pasarela PayPal sandbox (KAN-148)

- Nuevo adaptador `PayPal` (`packages/infrastructure/src/pagos/paypal.ts`)
  del puerto `PasarelaPago`, sobre la Orders API v2 de PayPal. Selector
  `PASARELA=paypal` en `apps/backend/src/lib/pasarela.ts`; variables
  `PAYPAL_ENTORNO` (`sandbox` | `produccion`), `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET` (obligatorias con `PASARELA=paypal`) y
  `PAYPAL_CLP_POR_USD` (default 950).
- PayPal no acepta CLP: se cobra en USD con esa tasa. El monto en pesos va en
  `custom_id` y es el que `confirmarRetornoPago` compara con el total de la
  orden, así que la tasa no puede producir un rechazo falso al confirmar.
- `PagoIniciado` y la respuesta de `POST /ordenes/:id/pago` tienen un campo
  nuevo `metodo` (`"POST"` por defecto, `"GET"` con PayPal). Es aditivo: los
  clientes que no lo leen siguen funcionando con Webpay.
- Nueva ruta pública `GET /pagos/paypal/retorno`: traduce el retorno de PayPal
  (`?token=<id>` si aprobó, `resultado=cancelado` si anuló) a la forma que ya
  entiende `confirmarRetornoPago` y redirige igual que Webpay.
- Ecommerce: `NavegadorPasarela.ir` redirige con GET cuando `metodo` es `GET`
  y envía el formulario POST en los demás casos. Los textos dejaron de decir
  "Webpay" y hablan de "la pasarela de pago".
- Admin-site no usa la pasarela. Mobile ya abre `urlPago` con `launchUrl`
  (GET), que es lo que PayPal necesita; el retorno sigue yendo al ecommerce,
  no a la app (pendiente conocido de KAN-148).
- El medio de pago guardado sigue siendo `tarjeta` (sin migración).

### Job de vigencia de documentos (KAN-150)

- Caso de uso `actualizarVigenciaDocumentos` y script
  `pnpm --filter=@cotizapp/backend job:vigencia-documentos`: recalcula
  `proveedor_documento.estado` (`al_dia` / `por_vencer` / `vencido`) con
  `vigenciaDocumento` (la misma regla que el panel: por vencer a <= 45 días),
  con la fecha de hoy en hora de Chile. Idempotente, auditado y tolerante a
  fallos por documento.
- Nuevos métodos en `ProveedorRepository`: `listarVigenciaDocumentos` y
  `actualizarVigenciaDocumento` (con su auditoría en la misma transacción).

### `FASTIFY_TRUST_PROXY` (rate limit detrás de Nginx)

- La variable ya figuraba en `.env.example` pero ningún código la leía. Ahora
  `config/env.ts` la valida (`true` | `false`, default `false`) y `server/app.ts`
  la pasa a Fastify como `trustProxy`. Sin esto, tras Nginx `request.ip` era la
  IP del proxy y el rate limit (login, registro, recuperación, eventos)
  contaba a todos los usuarios como uno solo.
- `infra/docker-compose.prod.yml` la activa (`"true"`): ahí solo Nginx publica
  puertos, así que el backend no es alcanzable directo y `X-Forwarded-For` no
  se puede falsificar desde fuera. No activarla si el backend queda expuesto.

## Por qué

Webpay en producción exige cuenta empresa; para probar el flujo de compra
completo se necesitaba una pasarela con sandbox sin trámites. El job era el
último criterio de aceptación sin cubrir de KAN-150: hasta ahora la vigencia
solo se calculaba al consultar, y la columna guardada podía quedar vieja.

## Archivos

- `packages/infrastructure/src/pagos/paypal.ts` (+ test), `src/index.ts`
- `packages/domain/src/services/pasarela-pago.ts`
- `packages/application/src/use-cases/pagos.use-cases.ts`,
  `vigencia-documentos.use-case.ts` (+ test)
- `packages/domain|infrastructure/.../proveedor.repository.ts`
- `apps/backend/src/lib/pasarela.ts`, `config/env.ts`, `routes/pagos/index.ts`,
  `jobs/vigencia-documentos.ts`, `package.json`, `.env.example`, `README.md`
- `apps/ecommerce/src/app/core/checkout/*`, `features/checkout|pedidos/*`
- `apps/mobile/API_CONTRACT.md`

## Probado contra el sandbox real (2026-11-21)

Con las credenciales de la app `Default Application` del sandbox, desde el
backend local: OAuth 200; comprador de prueba nuevo → carro → confirmar orden
(`CM-90001`, $9.390) → `POST /ordenes/1/pago` crea una orden real en
PayPal y devuelve `pasarela: "paypal"`, `metodo: "GET"` y la URL
`sandbox.paypal.com/checkoutnow?token=...`. La anulación
(`/pagos/paypal/retorno?resultado=cancelado&token=...`) deja el pago
`fallido`, redirige (303) al ecommerce con `pago=anulado`, y el reintento
crea otra orden en PayPal.

**Aprobación y captura (probadas):** el comprador pagó `CM-90001` con una
cuenta Personal del sandbox y PayPal lo devolvió al retorno. Resultado: orden
`pagada` / `pagado` con `medio_pago = tarjeta`; auditoría `pago_aprobado`
con `pasarela: "paypal"` y `monto: 9390`; boleta (DTE 39, folio 1) y guía de
despacho (DTE 52, folio 1); correo de confirmación al comprador y aviso de
nueva orden a `ventas@andina.test` (en `MAIL_OUT_DIR`); envío en
`por_despachar`. Falta probar un pago rechazado por PayPal (captura no
COMPLETED), que solo está cubierto por tests.

Para preparar la prueba hubo que corregir la base local, que venía de antes
del merge: faltaba la tabla `calificacion` (se creó desde la migración 0000) y
`proveedor_cobertura` estaba vacía (se agregaron 2 zonas de prueba para la
región RM, proveedores 2 y 3, $3.990 y $4.990).

## Para probarlo

1. Crear una app Sandbox en <https://developer.paypal.com/dashboard/applications>
   y copiar su Client ID y Secret a `apps/backend/.env`
   (`PASARELA=paypal`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`).
2. Reiniciar el backend (`docker compose up -d --force-recreate backend`).
3. Pagar en el ecommerce con una cuenta Personal de *Sandbox accounts*.

## Pendiente

Programar el cron del job en producción; devolución por pasarela
en reembolsos (`devolverDinero`).
