# Correos de compra, caso de moderación en reembolsos y decisión Fastify

**Fecha:** 2026-11-21 · **Épica:** KAN-88 · **Tickets:** KAN-156, KAN-155, KAN-169

## Qué cambió

- **Correos al aprobarse un pago (KAN-156).** Nuevo caso de uso
  `notificarOrdenPagada`: envía la confirmación de compra (con folio y total)
  al comprador y el aviso de nueva orden a cada proveedor que tenga un envío
  en la orden (a su `email_contacto`). Cada correo es independiente: si uno
  falla se registra en el log y se sigue; nunca revierte el pago. Se dispara
  desde el retorno de Webpay mediante el nuevo hook `alPagar` de
  `confirmarRetornoPago`, junto a `alAprobar` (documentos tributarios).
  Solo se ejecuta si el pago se aplicó por primera vez, así que un retorno
  repetido no reenvía correos.
- **Caso de moderación en reembolsos (KAN-155).** `crearReembolso` abre un
  caso `reembolso` (entidad `orden`) para que quede en la cola de moderación.
  Es idempotente (no duplica un caso abierto) y, si abrirlo falla, el
  reembolso ya emitido no se afecta. Con esto los tres casos automáticos del
  ticket quedan conectados: alta de proveedor (registro), precio fuera de
  rango (ofertas) y reembolso.
- **Fastify se mantiene (KAN-169).** Decisión movida a
  [decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md) con su razón y
  el plan de onboarding para quien viene de Express.

## Por qué

Las plantillas de correo existían desde KAN-156 pero ningún flujo las
llamaba, y `abrirCasoModeracion` no tenía disparador para reembolsos. El
pago real (Webpay, KAN-95/148) ya estaba integrado por el equipo, así que
ahora hay un punto natural donde disparar los correos.

## Archivos

- `packages/application/src/use-cases/notificar-orden-pagada.use-case.ts` (+ test)
- `packages/application/src/use-cases/pagos.use-cases.ts` (hook `alPagar`)
- `packages/application/src/use-cases/reembolsos.use-cases.ts` (+ test)
- `apps/backend/src/routes/pagos/index.ts`, `apps/backend/src/routes/reembolsos/index.ts`
- `docs/decisiones/*`, `docs/epicas/EPICA-KAN-88-plataforma.md`

## Pendiente

Servidor SMTP real (en `MAIL_DRIVER=consola` los correos se escriben en
`MAIL_OUT_DIR`).
