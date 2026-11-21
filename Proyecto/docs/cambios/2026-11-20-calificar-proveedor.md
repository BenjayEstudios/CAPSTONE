# Calificar al proveedor tras la entrega

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-99

## Qué cambió

El comprador califica al distribuidor de cada envío entregado desde el
detalle de su pedido (`/pedidos/:id`), y la calificación se suma al promedio
que muestra el comparador.

| Criterio | Cómo |
|---|---|
| Solo se puede calificar un envío en estado entregado, una vez | El formulario aparece solo en los envíos `entregado`. El backend lo garantiza: `CalificacionRepository.registrar` (KAN-142) inserta con un `INSERT … SELECT` que exige el envío entregado y de la organización del usuario, y el `UNIQUE` por envío impide la segunda. La API responde `409 ENVIO_NO_CALIFICABLE` o `409 YA_CALIFICADO` |
| Puntaje 1–5 y comentario opcional | "¿Cómo te fue con {distribuidor}?": cinco estrellas (radios accesibles, con "Muy malo" … "Excelente") y un comentario de hasta 500 caracteres. Al enviar se muestra "Tu calificación ★★★★ Bueno" con el comentario |
| El promedio del proveedor se ve en la ficha de producto | Ya estaba (KAN-92): "★ 3.80 (5)" junto a cada distribuidor, calculado al vuelo. Probado: una calificación de 4 a Valle Central lo llevó a "★ 3.83 (6)" |

### API

- `POST /ordenes/envios/:id/calificacion` (cliente):
  - Body: `{ puntaje, comentario? }`. El usuario sale del token.
  - Respuesta `201` con la calificación.
  - Errores: `409 YA_CALIFICADO`, `409 ENVIO_NO_CALIFICABLE`, `400 VALIDACION`; `403` si no es comprador.
- `GET /ordenes/:id` (aditivo): `envios[].calificacion: { puntaje, comentario, creadaEn } | null` para el cliente, en el detalle. La app móvil ya lo pedía en el contrato.

## Por qué así

- **La regla vive en la base, no solo en la pantalla**: el `INSERT … SELECT`
  y el `UNIQUE` aguantan dos envíos a la vez; el caso de uso solo traduce
  `CalificacionError` a la API.
- **El promedio no se guarda**: se calcula en la consulta del comparador
  (decisión de KAN-142), así una calificación nueva se ve de inmediato.
- **La calificación va en el detalle de la orden** para que la pantalla sepa
  si ofrecer el formulario sin otra llamada.

## Pruebas

- Application (`calificaciones.use-cases.test.ts`): registra con el usuario del token y comentario vacío como null; traduce `ya_calificado` y `envio_no_calificable`; valida el puntaje; un proveedor recibe 403.
- Backend (`routes/ordenes/calificacion.test.ts`): 401 sin sesión, 201, los dos 409, 400 y 403.
- Infrastructure (`checkout.repository.test.ts`): el detalle trae la calificación de cada envío, o null.
- Ecommerce (`features/pedidos/calificar-envio.spec.ts`):
  - El botón espera el puntaje; se envían puntaje y comentario, y queda la calificación.
  - Si ya está calificado, se muestra la calificación; el error `YA_CALIFICADO` se explica.
  - El detalle ofrece calificar solo los envíos entregados.
- En el navegador como El Fogón: con el envío de CM-10011 marcado como entregado para la prueba, se calificó con 4 estrellas y comentario. La calificación quedó al recargar y la ficha del tomate pasó de ★ 3.80 (5) a ★ 3.83 (6). Después se restauró el envío y se borró la calificación.

## Archivos

- `packages/domain/src/dtos/calificacion.dto.ts` (`calificarEnvioSchema`), `repositories/orden.repository.ts`.
- `packages/application/src/use-cases/calificaciones.use-cases.ts`, `ordenes.use-cases.ts`.
- `packages/infrastructure/src/repositories/orden.repository.ts`.
- `apps/backend/src/routes/ordenes/index.ts` (`calificarEnvioRoute`).
- `apps/ecommerce/src/app/features/pedidos/calificar-envio.component.ts`, `detalle-orden.component.*`, `core/checkout/checkout.service.ts` (`calificar`), `core/models/checkout.models.ts`.
