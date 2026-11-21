# Panel del proveedor: cómo se compara tu precio

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-104

## Qué cambió

En "Mis productos" (`/proveedor/productos`) hay un bloque nuevo, **"Cómo se
compara tu precio"**. Por cada oferta publicada muestra:

| Dato | Cómo se calcula |
|---|---|
| Posición | Cuántas ofertas publicadas del mismo producto (de proveedores activos) están más baratas, más uno: "2.º de 5". Un empate cuenta como la misma posición |
| Diferencia con el más bajo | Mi precio menos el más bajo: "+$200 sobre el más bajo". Si soy el más bajo dice "eres el más bajo"; si empato sin ser el primero de la lista, "empatas con el más bajo"; si nadie más lo publica, "eres el único que lo publica" |
| Precio más bajo | "el más bajo publica $6.990", solo cuando hay otros proveedores |

El bloque se recalcula cuando el proveedor cambia un precio, pausa, reactiva o
publica una oferta, porque cualquiera de esas acciones lo mueve frente a los
demás. Las ofertas pausadas y los borradores no aparecen ni cuentan.

### API

- `GET /ofertas/comparacion` (nuevo, proveedor): `{ items: [{ ofertaId,
  productoId, producto, formato, miPrecio, posicion, total, precioMasBajo,
  diferencia }] }`, una fila por oferta publicada propia, ordenadas por nombre
  de producto.

## Por qué así

- **Se compara el precio por caja publicado** (`precio_unitario`), que es lo
  que ve el comprador en el comparador de la ficha. Comparar por kilo o litro
  mezclaría formatos distintos, y aquí todos son el mismo producto y formato.
- **No se muestra quién es el más barato**: el proveedor ve su posición y el
  precio más bajo, no el nombre del competidor. Eso basta para decidir si bajar
  el precio, y no expone a los demás.
- **Solo cuentan las ofertas publicadas de proveedores activos**: son las que
  compiten de verdad en el catálogo.
- **Una sola consulta agregada** (auto-join de `oferta`) en vez de pedir las
  ofertas de cada producto: el bloque sale con un request.

## Corrección en los tests de infraestructura

Al correr la suite completa apareció que el helper `test/db.ts` no aislaba los
tests cuyo repositorio abre su propia transacción: hacía `START TRANSACTION`
crudo, y el `BEGIN` del repositorio en MySQL confirma la transacción en curso.
El test de `registrarResultadoPago` dejaba la orden CM-10001 del seed con
`referencia_pasarela = 'tok-prueba'` y una fila de auditoría por corrida, y lo
que quedaba confirmado lo veían otros tests (los fallos intermitentes de
`embudoPorProducto`).

Ahora cada test corre dentro de una transacción de Drizzle que siempre se
revierte; la transacción de un repositorio pasa a ser un `SAVEPOINT` dentro de
ella y también se revierte. Se quitaron los `ROLLBACK` crudos que
`cuenta.repository.test.ts` y `oferta.repository.test.ts` usaban para
esquivarlo. La orden CM-10001 se dejó como en el seed y se borraron las filas
de auditoría que habían quedado. Tres corridas seguidas dejan la base igual.

## Pruebas

- Application (`ofertas.use-cases.test.ts`): la comparación del proveedor sale
  de su organización; un usuario sin proveedor responde 403.
- Infrastructure (`checkout.repository.test.ts`): la posición, el total y el
  precio más bajo coinciden con un conteo hecho en SQL directo por producto.
- Ecommerce (`features/proveedor/productos.spec.ts`): el bloque muestra la
  posición, la diferencia y el precio más bajo (solo si hay otros); los textos
  de posición y diferencia, incluido el empate.
- En el navegador (Chrome) como Los Andes: "Arroz grado 1 · 2.º de 2 · +$200
  sobre el más bajo · el más bajo publica $6.990".

## Archivos

- `packages/domain/src/dtos/oferta.dto.ts` (`ComparacionOfertaDto`), `repositories/oferta.repository.ts` (`comparacion`).
- `packages/application/src/use-cases/ofertas.use-cases.ts` (`compararMisPrecios`).
- `packages/infrastructure/src/repositories/oferta.repository.ts`; `test/db.ts`, `test/checkout.repository.test.ts`, `test/cuenta.repository.test.ts`, `test/oferta.repository.test.ts`.
- `apps/backend/src/routes/ofertas/index.ts` (`GET /ofertas/comparacion`).
- `apps/ecommerce/src/app/features/proveedor/productos.component.*`, `productos.spec.ts`, `core/proveedor/ofertas-proveedor.service.ts`.
