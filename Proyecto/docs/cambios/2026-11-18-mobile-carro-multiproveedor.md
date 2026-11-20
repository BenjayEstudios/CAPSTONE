# Mobile: carro multiproveedor

**Fecha:** 2026-11-18 · **Épica:** KAN-87 · **Ticket:** KAN-130

Pestaña **Carro** del comprador, sincronizada con el carro del backend
(`GET /carro` y `PUT /carro`, que reemplaza todos los ítems):

- Un grupo por proveedor (será un envío de la orden) con su calificación,
  plazo de entrega (el mayor de sus ofertas), líneas y subtotal.
- Cambiar cantidad con "– N +" respetando el mínimo de compra
  (`cantidad × unidadesPorCaja ≥ minimoCompra`, la regla de
  `planificarOrden`) y el stock; quitar líneas.
- Resumen: productos, despachos (tarifa del proveedor, gratis sobre su
  umbral, con "gratis si sumas $X"), ahorro contra el proveedor más caro de
  cada producto y total. Barra inferior con el total y "Ir a pagar".
- Avisa lo que el checkout rechazaría: precio cambiado ("Actualizar
  carro"), oferta ya no publicada y **cantidad sobre el stock**.
- "Agregar al carro" del comparador (KAN-129) ya funciona y el ícono de la
  pestaña muestra cuántas líneas hay.

**Base para los tickets siguientes — `FakeBackend`** (`lib/core/fake/`): un
backend en memoria, cargado con el seed, que comparten todos los fakes. Lo que
hace el comprador lo ve el distribuidor y al revés, y aplica las mismas
reglas que `packages/application` (carro, `planificarOrden`, alcance y
transiciones de órdenes, calificaciones, liquidaciones, estadísticas). Los
errores salen con el mismo status, `code` y `detalle` que el backend
(`Failure` ahora trae `code` y `detalle`). `seed_operacion.dart` copia
comunas, direcciones, puntos de retiro, coberturas, documentos y las 11
órdenes del seed; `eventos_sinteticos.dart` porta el generador de eventos del
seed (test contra la salida de node: los mismos 1996 eventos).

**Por qué**: el backend tiene `/carro`, pero sin `POST /auth/login` para
clientes no hay token; la app trabaja contra el fake y el remoto sigue la
forma real. La respuesta de `/carro` no trae nombre del proveedor, plazo ni
despacho: el repositorio los completa con la ficha del catálogo.

**Hallazgo**: el carro del seed de El Fogón pide 24 cajas de leche y la
oferta tiene 20; pagar ese carro falla con `SIN_STOCK` (también contra la
base del equipo). La app lo marca en la línea y no deja pagar hasta ajustar.

**Toca**: `apps/mobile/lib/features/carro/` (nuevo), `apps/mobile/lib/core/fake/{fake_backend,fake_providers,seed_operacion,eventos_sinteticos}.dart`
(nuevos), `apps/mobile/lib/core/fake/seed.dart`, `apps/mobile/lib/core/error/failure.dart`,
`apps/mobile/lib/core/network/api_client.dart`, `apps/mobile/lib/core/router/*`,
`apps/mobile/lib/features/catalogo/presentation/producto_page.dart`,
`apps/mobile/test/features/carro/`, `apps/mobile/test/core/fake/`, `apps/mobile/test/helpers/pruebas.dart`.
