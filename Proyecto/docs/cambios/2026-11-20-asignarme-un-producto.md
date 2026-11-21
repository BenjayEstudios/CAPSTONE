# Panel del proveedor: asignarme un producto (publicar oferta)

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-102

## Qué cambió

En el panel del proveedor, el botón **"Asignarme un producto"** (arriba a la
derecha, como en el mockup) abre `/proveedor/asignar`: el distribuidor busca
un producto del catálogo maestro y publica sus condiciones. No crea fichas.

| Criterio | Cómo |
|---|---|
| Buscador sobre el catálogo maestro | Por nombre, marca o SKU sobre los productos publicados que el proveedor todavía no ofrece (`GET /ofertas/productos-disponibles`), con la referencia de precio de cada uno |
| Campos: precio por unidad, unidades por caja, cajas, mínimo, plazo, corte, costo de despacho, despacho gratis desde, zonas, notas | Precio, unidades por caja, cajas, mínimo (unidades), plazo, modalidad (despacho, retiro o ambos) y notas son **de la oferta**. Corte, costo de despacho, despacho gratis desde y zonas son **del proveedor** en el modelo de datos (`organizacion.hora_corte`, `despacho_gratis_desde`, `proveedor_cobertura`), así que se muestran como "tus condiciones de despacho (valen para todas tus ofertas)" desde el nuevo `GET /proveedor/cobertura`; se editan en la cobertura de despacho (KAN-109) |
| Calcula stock total, valor del stock, precio por kg/L y posición frente a otros proveedores | Mientras escribe: "360 unidades", "$1.800.000", "$5.000/L" y "Serías el más barato de 3: el siguiente cobra $5.190" / "Quedarías 3.º de 3: el más barato cobra $5.190 ($2.810 menos)", con los precios publicados de la ficha |
| Publicar de inmediato o guardar como borrador | Opción al final; el botón dice "Publicar oferta" o "Guardar borrador". Al terminar: "Publicaste {producto} a $X. Ya aparece en el comparador" y el producto sale de la lista |
| Rechaza un precio sobre el tope de publicación de la ficha | Se muestra "Tope de publicación: $7.137 (referencia $5.490 + 30 %)". Sobre el tope, el botón de publicar se deshabilita y el backend responde `409 PRECIO_SOBRE_TOPE` con el máximo. Como **borrador** sí se guarda, y abre el caso `precio_fuera_rango` para que un administrador lo revise |

### API

- `POST /ofertas` y `PATCH /ofertas/:id`: una oferta que queda **publicada**
  con precio sobre `referencia × (1 + tope%)` → `409 PRECIO_SOBRE_TOPE`
  (`detalle: { precioMaximo, precioReferencia, topePct }`). Borrador o
  pausada: se guarda y abre el caso, como antes.
- `GET /ofertas/productos-disponibles`: agrega `contenido` (aditivo).
- `GET /proveedor/cobertura` (nuevo, `publicar_precio_stock`): `{ horaCorte,
  despachoGratisDesde, plazoEstandarHoras, ofreceDespacho, ofreceRetiro,
  zonas: [{ comunaId, comuna, regionCodigo, region, costoDespacho, plazoHoras }] }`.

## Por qué así

- **El tope ahora bloquea la publicación** (decidido con el equipo el
  2026-11-20 para cumplir el criterio de KAN-102; reemplaza la decisión de
  KAN-146, ver [decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md)).
  Se mantiene el borrador con caso para que un precio fuera de rango no se
  pierda: el administrador lo ve en moderación y el proveedor puede bajar el
  precio y publicar.
- **Corte, despacho y zonas por proveedor, no por oferta**: así está el
  modelo de datos y así calcula el despacho el checkout; tener zonas por
  producto exigiría otra tabla. La pantalla lo dice explícitamente.
- **Una pantalla en vez del diálogo del mockup**: tiene buscador, formulario
  y cálculos; en una ruta propia se puede enlazar y funciona mejor en el
  teléfono.

## Pruebas

- Application (`ofertas.use-cases.test.ts`):
  - Publicar sobre el tope da 409 y no crea nada; subir el precio de una publicada sobre el tope, también.
  - Un borrador sobre el tope se guarda con su caso (uno solo); publicarlo se rechaza, y bajando al tope sí se publica.
- Infrastructure (`checkout.repository.test.ts`): cobertura del proveedor (corte, zonas, región por nombre) y `contenido` en productos disponibles.
- Ecommerce (`features/proveedor/asignar.spec.ts`):
  - Tope y posición frente a otros.
  - Cálculos y condiciones de entrega en pantalla.
  - Sobre el tope: no se publica, como borrador sí (y lo avisa).
  - Cuerpo del POST con mínimo y notas; `OFERTA_DUPLICADA` se explica; campos obligatorios.
- En el navegador (Chrome) como Los Andes:
  - Buscó y eligió "Crema para batir".
  - Con $8.000 vio el tope y el botón deshabilitado ("Quedarías 3.º de 3").
  - Con $5.000 ("Serías el más barato de 3") publicó; en la base quedaron la oferta y su historial, sin caso de moderación.
  - Después se borró la oferta de prueba.

## Archivos

- `packages/application/src/use-cases/ofertas.use-cases.ts` (`exigirBajoTope`), `panel-proveedor.use-cases.ts` (`miCobertura`).
- `packages/domain`: `dtos/oferta.dto.ts` (`contenido`), `repositories/proveedor.repository.ts` (`cobertura`, `CondicionesEntregaProveedor`).
- `packages/infrastructure/src/repositories/{oferta,proveedor}.repository.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts`, `routes/index.ts`.
- `apps/ecommerce/src/app/features/proveedor/asignar.component.*`, `asignar.spec.ts`, `panel-proveedor.component.ts` (botón), `core/proveedor/ofertas-proveedor.service.ts`, `app.routes.ts`.
