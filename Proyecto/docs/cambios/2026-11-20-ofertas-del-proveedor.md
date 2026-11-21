# Ofertas del proveedor

**Fecha:** 2026-11-20 · **Épica:** KAN-88 · **Ticket:** KAN-146 (desbloquea
KAN-102 a KAN-104 del panel del proveedor)

## Qué cambió

API para que el proveedor publique y edite sus ofertas. Todas las rutas
exigen sesión y el permiso `publicar_precio_stock`, y operan **solo** sobre
las ofertas de la organización de la sesión (una ajena responde 404, igual
que una inexistente). Un usuario que no es de un proveedor recibe
`403 SOLO_PROVEEDORES`.

| Ruta | Qué hace |
|---|---|
| `GET /ofertas?estado&q&pagina&tamano` | Mis ofertas, con los datos del producto |
| `GET /ofertas/productos-disponibles?q&categoriaId&pagina&tamano` | Productos publicados que todavía no oferto ("Asignarme un producto") |
| `GET /ofertas/:id` | Una oferta mía |
| `POST /ofertas` | Crear: `201 { oferta, revisionPrecio }`. Una por producto × proveedor (`409 OFERTA_DUPLICADA`) |
| `PATCH /ofertas/:id` | Editar precio, stock, caja, mínimo, plazo, modalidad, notas o estado; `motivo` opcional |
| `DELETE /ofertas/:id` | Solo borradores sin ventas (`204`); lo demás `409 OFERTA_NO_ELIMINABLE` |

**Estados:** al crear, `publicada` (default) o `borrador`; después,
`publicada` ↔ `pausada`. Una oferta publicada no vuelve a borrador. Publicar
exige que la organización esté `activa` (`409 PROVEEDOR_NO_ACTIVO`).

**Tope de precio:** si el producto tiene `precio_referencia` y
`tope_sobre_referencia_pct`, un precio sobre `referencia × (1 + tope%)` abre
un caso `precio_fuera_rango` en moderación (uno solo por oferta mientras
siga abierto) y la respuesta trae `revisionPrecio: { casoId,
precioReferencia, topePct, precioMaximo }`. Moderación ahora describe la
entidad `oferta` como "Producto · Proveedor · $precio" en admin-site.

**Historial:** crear inserta la fila inicial en `oferta_precio_historial`
(`precio_anterior` nulo, motivo "Creacion de la oferta"); cada cambio de
precio o de cajas inserta otra, en la misma transacción que el cambio, con
el `motivo` si vino. Cambiar notas o plazo no deja fila.

## Por qué así

- **El tope abre un caso pero no bloquea.** El criterio pide validar el tope
  y abrir un caso; bloquear la publicación exigiría un flujo de "aprobar
  precio" que moderación no tiene (solo resolver o descartar). El
  administrador revisa el caso y, si corresponde, contacta al proveedor.
  Si el equipo prefiere bloquear, el punto de cambio es `revisarTope` en
  `ofertas.use-cases.ts`.
- **Borrar solo borradores.** Una oferta que se publicó puede estar en
  órdenes y tiene historial (tabla de solo inserción): se pausa. Un borrador
  nunca se mostró, así que se borra con su fila inicial de historial.
- **404 para ofertas ajenas**, para no revelar qué ofertas tienen otros
  proveedores.

## Pruebas

- `packages/application/src/use-cases/ofertas.use-cases.test.ts` (10
  casos): tope (justo en el límite, sin referencia, un caso por oferta),
  historial, estados, duplicadas, proveedor en revisión, ofertas ajenas,
  eliminación.
- `packages/infrastructure/test/oferta.repository.test.ts` (6, contra
  MySQL): transacción oferta + historial, productos disponibles, filtros,
  eliminación, etiqueta de moderación.
- `apps/backend/src/routes/ofertas/ofertas.test.ts`: guardias y códigos HTTP.
- Probado contra la base con la cuenta de Los Andes: crear, duplicar, subir
  sobre el tope (caso #3 visible en admin-site → Moderación con la etiqueta
  de la oferta), pausar (la oferta sale del catálogo público), borrar.

## Toca

`packages/domain/src/{dtos/oferta.dto.ts,repositories/oferta.repository.ts,dtos/index.ts,repositories/index.ts}`,
`packages/application/src/use-cases/{ofertas.use-cases.ts,index.ts}`,
`packages/infrastructure/src/repositories/{oferta.repository.ts,moderacion.repository.ts,index.ts}`,
`apps/backend/src/routes/{ofertas/*,index.ts}`, tests nuevos y docs.
