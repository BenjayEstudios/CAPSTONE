# Panel del proveedor: mis productos publicados

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-103

## Qué cambió

Nueva pestaña **"Mis productos"** en el panel del proveedor
(`/proveedor/productos`): sus ofertas en una tabla, con edición en la misma
fila.

| Criterio | Cómo |
|---|---|
| Tabla: producto, formato, precio, unitario, cajas, unidades, despacho, mínimo, estado | Las nueve columnas, como en el mockup. Unitario = precio / contenido ("$2.498/L"); unidades = cajas × unidades por caja; despacho = plazo y modalidad; estado: Publicada, Pausada, Borrador, y en las publicadas "Stock bajo" (20 cajas o menos, igual que el dashboard) o "Sin stock". Filtros por estado y búsqueda por nombre o SKU |
| Editar precio y stock; pausar y reactivar la oferta | "Editar" abre la fila: precio, cajas y un motivo opcional; muestra el tope de publicación y no deja guardar una publicada sobre él. "Pausar" / "Reactivar" en cada fila; un borrador se puede "Publicar" o borrar |
| Cada cambio de precio o stock queda en `oferta_precio_historial` | Lo hace el backend en la misma transacción que el cambio (KAN-146). Ahora además se ve: la fila abierta muestra el **historial de precio y stock** ("20 nov, 08:28 p. m. Precio $7.590 → $7.390 · Cajas 30 → 45 · llegó un camión · Ventas Los Andes") |

### API

- `GET /ofertas` y `GET /ofertas/:id`: `producto.contenido` y
  `producto.topeSobreReferenciaPct` (aditivos).
- `GET /ofertas/:id/historial` (nuevo): los últimos 20 cambios de precio y
  stock de una oferta propia, con quién los hizo (una ajena responde 404).

## Por qué así

- **Edición en la fila** en vez de otra pantalla: el proveedor cambia precio o
  stock seguido y quiere ver el resto de la tabla mientras lo hace.
- **El historial se muestra**: el criterio pide que quede registrado; verlo en
  pantalla deja comprobarlo sin entrar a la base y le sirve al proveedor.
- **El tope también vale al editar**: es la misma regla de KAN-102 (una oferta
  publicada no puede quedar sobre el tope).

## Pruebas

- Application (`ofertas.use-cases.test.ts`): el historial trae el alta y cada cambio de precio o stock en orden; cambiar solo notas no deja fila; de otra oferta responde 404.
- Infrastructure (`checkout.repository.test.ts`): mis ofertas traen contenido y tope; el historial coincide con la tabla e incluye quién cambió.
- Ecommerce (`features/proveedor/productos.spec.ts`):
  - Tabla con las 9 columnas y sus valores.
  - Filtros.
  - Editar precio y stock con motivo, y el historial recargado.
  - Pausar, y reactivar rechazado por el tope; una publicada no se guarda sobre el tope.
  - Etiquetas de estado.
- En el navegador (Chrome) como Los Andes:
  - Se editaron los guantes: $7.590 → $7.390 y 30 → 45 cajas, con motivo. La fila y el historial se actualizaron, y en la base quedó la fila del historial con el usuario.
  - Se pausaron y se reactivaron.
  - Después se restauró la oferta y se borró la fila de prueba.

## Archivos

- `packages/domain/src/dtos/oferta.dto.ts` (`CambioOfertaDto`, campos de producto), `repositories/oferta.repository.ts` (`historial`).
- `packages/application/src/use-cases/ofertas.use-cases.ts` (`historialMiOferta`).
- `packages/infrastructure/src/repositories/oferta.repository.ts`.
- `apps/backend/src/routes/ofertas/index.ts`.
- `apps/ecommerce/src/app/features/proveedor/productos.component.*`, `productos.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/ofertas-proveedor.service.ts`, `core/api/api.client.ts` (`patch`, `delete`), `app.routes.ts`.
