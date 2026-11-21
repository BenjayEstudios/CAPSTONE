# Ecommerce: carro multiproveedor

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-94

## Qué cambió

`/carro` dejó de ser una pantalla provisoria. Es un solo carro con ofertas de
varios distribuidores, como en el mockup del cliente.

| Criterio | Cómo |
|---|---|
| Líneas agrupadas por proveedor con plazo y subtotal por grupo | Un bloque por distribuidor con "Entrega 24 h" (el plazo más largo de sus líneas, igual que el envío del checkout) y "Subtotal $X". Cada grupo termina con su despacho: "Despacho de Los Andes Food Service: $4.990 · gratis sobre $150.000" |
| Cambiar cantidad (+/–) respetando el mínimo; eliminar línea | La cantidad va en cajas. El "–" no baja de las cajas que cumplen el mínimo de compra (que está en unidades) y el "+" no pasa del stock. "×" quita la línea. Cada cambio es un `PUT /carro` |
| Resumen: productos, despachos por proveedor, ahorro vs. comprar al más caro y total | Columna "Resumen" con Productos (n), Despachos (n), "Ahorro vs. comprar al más caro" y Total, más "Continuar al pago" y "Seguir comprando" |
| Estado vacío con link al catálogo | "Todavía no agregas nada" con "Ir al catálogo" |
| Aviso si un precio cambió desde que se agregó (`precio_visto`) | "Algunos precios cambiaron desde que los agregaste", con el precio anterior y el nuevo de cada línea, y "Aceptar los precios nuevos" (manda `precioVisto` = precio de hoy) |

También avisa lo que el checkout rechazaría, y no deja continuar al pago
hasta resolverlo:

- Más cajas que el stock que queda: "Solo quedan 20 cajas. Ajustar a 20". Es
  el caso del carro de El Fogón en el seed.
- Una línea bajo el mínimo de compra: "Subir a N".
- Ofertas que el distribuidor pausó o retiró: van a un bloque "No
  disponibles" con "Quitarlos del carro". Mientras estén, `PUT /carro`
  responde 409, por eso hay que quitarlas antes de cambiar otra cosa.

## Cómo se calcula

`GET /carro` trae la oferta, la cantidad, el precio visto y el de hoy, pero
no el nombre del distribuidor, el plazo, el mínimo ni el despacho. El
ecommerce los saca de la ficha de cada producto (`GET
/catalogo/productos/:id`, con el token del comprador, así el despacho es el
de su comuna), como ya decía el contrato del carro. Una ficha por producto
distinto, en paralelo, y solo las que faltan.

`features/carro/carro.calculo.ts` (`armarCarro`, función pura) sigue las
reglas de `planificarOrden` en el backend para que el carro muestre lo mismo
que se cobra:

- Subtotal de línea = precio de hoy × cajas (ver la
  [decisión abierta 12](../decisiones/DECISIONES-ABIERTAS.md) sobre si
  `precio_unitario` es por caja o por unidad).
- Despacho por distribuidor: tarifa a la comuna del comprador, gratis desde
  `despacho_gratis_desde`; sin costo si solo entrega con retiro. Si no
  despacha a la comuna, se avisa que en el pago se puede elegir retiro.
- Ahorro = por cada línea, (precio del distribuidor más caro del producto −
  precio de hoy) × cajas.

## Por qué así

- **Sin cambios en el backend.** El carro del backend (KAN-130) ya valida y
  guarda; lo que falta para mostrarlo está en la ficha. Agregar esos datos a
  `GET /carro` sería otro join para algo que la ficha ya resuelve, y cambiaría
  el contrato que usa la app móvil.
- **El despacho del carro es una estimación**: la entrega (despacho o retiro,
  y a qué dirección) se elige en el pago (KAN-95), y ahí se confirma el costo.
  El texto del resumen lo dice.
- **"Aceptar los precios nuevos" es explícito**: el checkout responde
  `PRECIO_CAMBIO` si `precio_visto` no coincide con el de hoy; es mejor que
  el comprador lo vea en el carro que en el pago.

## Pruebas

- `features/carro/carro.spec.ts`:
  - `armarCarro`: grupos, plazos, subtotales, despacho, ahorro y total; despacho gratis, retiro y sin cobertura; precio cambiado, stock, mínimo, no disponibles y bloqueos.
  - Pantalla: vacío, grupos y resumen, + y – con `PUT /carro` (el – se detiene en el mínimo), quitar, aceptar precios, ajustar al stock y continuar al pago.
- En el navegador contra el backend local: carro con dos distribuidores
  (despachos $10.980, ahorro y total cuadran), en escritorio y en teléfono.
  El carro de El Fogón en el seed trae 24 cajas de leche con 20 en stock.

## Archivos

- `apps/ecommerce/src/app/features/carro/`: `carro.component.{ts,html,css}`, `carro.calculo.ts`, `carro.spec.ts`.
- `apps/ecommerce/src/app/core/state/carro.state.ts`: `guardar`, `cambiarCantidad`, `quitar`, `aceptarPrecios` y `cargado`; los campos que pueden venir en `null`.
- `apps/ecommerce/src/app/shared/compra.ts`: `cajasMinimas` (antes en la ficha) y `cajas`.
- `apps/ecommerce/src/app/app.routes.ts`: la ruta real de `/carro`.
