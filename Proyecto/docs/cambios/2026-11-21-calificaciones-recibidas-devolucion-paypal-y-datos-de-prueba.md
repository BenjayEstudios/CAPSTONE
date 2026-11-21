# Calificaciones recibidas, devolución por PayPal y datos de prueba

**Fecha:** 2026-11-21 · **Épica:** KAN-88 · **Tickets:** KAN-200, KAN-148

## Qué cambió

### `GET /calificaciones/recibidas` (KAN-200)

- Endpoint para que un proveedor vea lo que recibió: `resumen` (promedio,
  cantidad y distribución por puntaje 1 a 5), `entregasATiempoPct` e `items`
  paginados (más nueva primero) con folio de la orden, organización compradora,
  puntaje, comentario y fecha. Respeta la forma de `apps/mobile/API_CONTRACT.md`
  y agrega `total`, `pagina` y `tamano` (query `pagina`/`tamano`, default 1 y
  20, máx. 100).
- `requireAuth` + `requirePermiso("ver_ordenes_propias")`, y el caso de uso
  exige además que el usuario esté activo y su organización sea proveedor
  (otro tipo: 403). Verificado en vivo: sin token 401, proveedor 200.
- `CalificacionRepository` suma `resumenRecibidas` y `listarRecibidas`
  (el promedio se calcula en cada consulta, como el resto del módulo).
- Desbloquea la pantalla de calificaciones de la app móvil (KAN-135).

### Devolución del dinero por PayPal en reembolsos (KAN-148)

- `PasarelaPago` tiene un método opcional `devolver`. `PayPal` lo implementa:
  busca la captura de la orden y llama a `POST /v2/payments/captures/{id}/refund`
  con el monto en USD (misma tasa del cobro). Si PayPal lo rechaza, lanza.
- `POST /ordenes/:id/reembolsos` conecta `devolverDinero` cuando la pasarela
  activa puede devolver. El reembolso (nota de crédito y estado) se registra
  igual y la respuesta informa `devolucionPasarela`: `ok`, `error` (la
  devolución falló y hay que reintentarla a mano) o `no_integrada` (Webpay, que
  aún no lo implementa).
- Probado en el sandbox: reembolso parcial de $1.000 sobre `CM-90001` →
  `devolucionPasarela: "ok"`.

### Datos de prueba (`job:datos-de-prueba`)

- Script del backend que carga movimientos variados en la base local para
  probar los paneles (ver `apps/backend/README.md`): 8 órdenes con pagos
  aprobados, rechazado, anulado y sin iniciar; envíos en todos los estados;
  boleta, factura y guías; reembolso parcial y total; calificaciones;
  liquidaciones (una pagada); casos de moderación y eventos.

### Ajuste de entorno local

- El `.env` local tenía `CORS_ORIGIN=http://localhost:4300` (solo el
  admin-site): el navegador bloqueaba las llamadas del ecommerce (4200) y el
  catálogo no cargaba. Ahora lista 4200 y 4300. Es un archivo no versionado.

## Archivos

- `packages/domain`: `entities/calificacion.entity.ts`, `dtos/calificacion.dto.ts`,
  `repositories/calificacion.repository.ts`, `services/pasarela-pago.ts`
- `packages/application`: `use-cases/calificaciones.use-cases.ts` (+ test)
- `packages/infrastructure`: `repositories/calificacion.repository.ts`,
  `pagos/paypal.ts` (+ tests)
- `apps/backend`: `routes/calificaciones/index.ts`, `routes/index.ts`,
  `routes/reembolsos/index.ts`, `jobs/datos-de-prueba.ts`, `package.json`, `README.md`
- `apps/mobile/API_CONTRACT.md`, `docs/epicas/EPICA-KAN-88-plataforma.md`
