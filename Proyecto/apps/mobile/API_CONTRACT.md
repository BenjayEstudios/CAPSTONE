# Contrato de API — app mobile

Endpoints de `apps/backend` que usa `apps/mobile`. Cada feature tiene dos
datasources detrás de la misma interfaz: el **fake** (default,
`USE_FAKES=true`, datos del seed en `lib/core/fake/`) y el **remoto**, que
llama exactamente lo que dice este archivo. Para pasar a la API real basta
`--dart-define=USE_FAKES=false`; no se tocan pantallas.

Estado: ✅ existe en el backend (forma real, sacada de `apps/backend/src/routes/**`
y `packages/application`) · ⏳ falta (especificado acá; la app usa el fake).

> **Bloqueo principal**: el único login es `POST /auth/admin/login`, que
> rechaza a quien no sea de la organización interna. Sin
> [`POST /auth/login`](#-post-authlogin--kan-126) los compradores y
> distribuidores no obtienen token, así que ni los endpoints ✅ se pueden usar
> desde la app todavía.

## Índice

| Endpoint | Estado | Lo usa |
|---|---|---|
| `GET /health-check` | ✅ | Conexión |
| `GET /categorias` | ✅ | Catálogo (KAN-127) |
| `POST /auth/login` | ✅ | Login (KAN-126) |
| `GET /catalogo/productos` | ✅ | Inicio, listado y búsqueda (KAN-127, 128) |
| `GET /catalogo/productos/:id` | ✅ | Ficha con comparador (KAN-129) |
| `GET /carro` · `PUT /carro` | ✅ | Carro (KAN-130) |
| `GET /carro/opciones-entrega` | ✅ | Checkout (KAN-131, KAN-95) |
| `GET /comunas` | ✅ | Checkout (KAN-131, KAN-95) |
| `POST /carro/confirmar` | ✅ | Checkout (KAN-131) |
| `POST /ordenes/:id/pago` | ✅ Webpay | Checkout y pago (KAN-131, KAN-95, KAN-148) |
| `GET /ordenes` · `GET /ordenes/:id` | ✅ + campos ⏳ | Mis pedidos (KAN-132), órdenes vigentes (KAN-136) |
| `PATCH /ordenes/envios/:id/estado` | ✅ | Órdenes vigentes (KAN-136) |
| `POST /ordenes/envios/:id/calificacion` | ⏳ | Mis pedidos (KAN-132) |
| `GET /estadisticas/proveedor/ventas` | ⏳ | Estadísticas de venta (KAN-133) |
| `GET /estadisticas/proveedor` | ✅ + campo ⏳ | Visitas y conversión (KAN-134) |
| `POST /eventos/lote` | ✅ | Vistas, búsquedas y clicks del comprador (KAN-134) |
| `GET /calificaciones/recibidas` | ⏳ | Calificaciones recibidas (KAN-135) |
| `GET /alertas/proveedor` | ⏳ | Alertas (KAN-137) |

## Convenciones

- **Base URL**: local `http://localhost:8000` (emulador Android:
  `http://10.0.2.2:8000`); producción `http://<APP_DOMAIN>/api` (nginx quita
  el prefijo `/api`, ver `infra/nginx/snippets/api-proxy.conf`).
- **JSON en camelCase**, salvo `/eventos`, que va en snake_case como las
  columnas (así lo define `eventoEntradaSchema`).
- **Montos**: enteros en CLP. **Fechas**: ISO 8601 (`2026-10-20T20:40:00.000Z`);
  los rangos de estadísticas usan `AAAA-MM-DD`.
- **Auth**: `Authorization: Bearer <JWT>` con claims `sub`, `organizacionId`,
  `rol` (`plugins/auth.ts`).
- **Errores** (`lib/error-handler.ts`):

  ```json
  { "error": { "code": "PRECIO_CAMBIO", "message": "El precio de algunas ofertas cambio", "detalle": { "lineas": [] } } }
  ```

  La app decide por status (401 vuelve al login, 403 sin permiso, 404 no
  encontrado, 400/409/422 validación) y por `code` para el texto: los
  `message` del backend van sin tildes y pensados para desarrolladores, así
  que las pantallas traducen los `code` conocidos y usan `detalle` cuando
  existe.

---

## ✅ `GET /health-check`

Público. `{ "status": "ok", "timestamp": "2026-10-23T15:00:00.000Z" }`

## ✅ `GET /categorias`

Público. Lista plana del árbol de 2 niveles; la app descarta las `oculta`.

```json
[{ "id": 8, "padreId": 1, "nombre": "Aceites", "slug": "aceites", "orden": 1, "estado": "activa" }]
```

## ✅ `POST /auth/login` — KAN-126 (implementado en KAN-144)

Login de comprador y distribuidor. Mismas reglas que `loginAdmin`
(`packages/application/src/use-cases/login-admin.use-case.ts`: bcrypt,
mensaje genérico, 2FA TOTP solo para internos) **sin** exigir organización
interna: acepta organizaciones `cliente` y `proveedor`. La app rechaza por su
cuenta los roles internos.

Request: `{ "email": "compras@elfogon.test", "clave": "Cotizapp.2026" }`

Response `200`: la misma forma que `/auth/admin/login` (`UsuarioSesionDto`)
**más el objeto `organizacion`**, que la app necesita para el saludo y la
cuenta:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 8,
    "nombre": "Compras El Fogón",
    "email": "compras@elfogon.test",
    "organizacionId": 6,
    "rol": "comprador",
    "permisos": { "ver_ordenes_propias": "total" },
    "organizacion": { "id": 6, "nombre": "El Fogón", "tipo": "cliente" }
  }
}
```

- `organizacion.nombre` = `nombre_fantasia` (o `razon_social` si es NULL).
- Errores: `401 CREDENCIALES_INVALIDAS` (email o clave), `403 USUARIO_NO_ACTIVO`
  (usuario no `activo` u organización no `activa`, ej. `contacto@laspalmas.test`),
  `400 VALIDACION`. Sin `POST /auth/logout`: el JWT no guarda estado.

## ✅ `GET /catalogo/productos` — KAN-127, KAN-128 (implementado en KAN-145)

Público. **No es** `GET /productos`, que ya existe como listado de
administración (exige `crear_producto` y devuelve fichas sin precios). Este es
el catálogo del comprador: cada producto con el rango de precios de sus
ofertas visibles. **Oferta visible** = `oferta.estado = 'publicada'` y
`organizacion.estado = 'activa'`. Producto sin ofertas visibles no aparece.

| Param | Regla |
|---|---|
| `q` | Busca en `nombre` (FULLTEXT `ix_producto_nombre_fulltext`) y `marca`, sin mayúsculas ni tildes |
| `categoriaId` | Esa categoría **y sus subcategorías** |
| `plazoMaxHoras` | Solo cuentan ofertas con `plazo_horas <= N` |
| `maxUnidadesPorCaja` | Solo cuentan ofertas con `unidades_por_caja <= N` ("caja chica", la app manda 6) |
| `orden` | `relevancia` (default), `precio` (precioDesde asc), `diferencia` (precioHasta − precioDesde desc, solo productos con 2+ ofertas), `nombre` |
| `pagina` / `porPagina` | Default `1` / `20` |

Agregados en KAN-90/91 (opcionales, la app puede ignorarlos): `maxMinimoCompra`, `conRetiro=true`, `marca`; cada item trae `proveedorMasBarato: { id, nombre }` y la respuesta `marcas: [{ marca, productos }]`.

Los filtros de plazo y caja se aplican **por oferta**: el producto aparece si
al menos una cumple, y los campos de precio se calculan solo con esas.

```json
{
  "items": [{
    "id": 1, "sku": "ACE-0001", "nombre": "Aceite vegetal maravilla", "marca": "Belmont",
    "formato": "Bidón 5 L", "contenido": 5, "unidad": "L", "categoriaId": 8, "imagenUrl": null,
    "precioDesde": 12490, "precioHasta": 12890, "ofertas": 2, "plazoMinHoras": 24
  }],
  "total": 17, "pagina": 1, "porPagina": 50
}
```

`contenido` como number (`decimal` llega como string desde mysql2: convertir).
El inicio pide `?orden=diferencia&porPagina=5`.

## ✅ `GET /catalogo/productos/:id` — KAN-129 (implementado en KAN-145)

Público. Ficha con todas las ofertas visibles ordenadas por `precioUnitario`
asc. `?origen=catalogo|busqueda|directo` se acepta, pero el `vista_producto`
**no** se registra acá: lo manda la app por `/eventos/lote` (registrarlo en
los dos lados lo contaría doble).

```json
{
  "id": 1, "sku": "ACE-0001", "nombre": "Aceite vegetal maravilla", "marca": "Belmont",
  "formato": "Bidón 5 L", "contenido": 5, "unidad": "L", "categoriaId": 8, "imagenUrl": null,
  "descripcion": null, "precioReferencia": 12990,
  "categoria": { "id": 8, "nombre": "Aceites", "padre": { "id": 1, "nombre": "Abarrotes" } },
  "ofertas": [{
    "id": 1, "precioUnitario": 12490, "unidadesPorCaja": 4, "cajasDisponibles": 40, "minimoCompra": 1,
    "plazoHoras": 24, "modalidadEntrega": "ambos", "notasCliente": null,
    "precioNormalizado": { "valor": 2498, "por": "L" },
    "proveedor": {
      "id": 2, "nombre": "Los Andes Food Service", "entregasATiempoPct": 96.5,
      "despachoGratisDesde": 150000, "costoDespacho": 4990,
      "zona": { "comuna": "Quilicura", "region": "Metropolitana de Santiago" },
      "calificacion": { "promedio": 4.67, "cantidad": 6 }
    }
  }]
}
```

- `precioNormalizado` (agregado en KAN-145): `precioUnitario / contenido`, por
  kg, L o unidad; `null` si el producto no declara contenido.
- `proveedor.costoDespacho`: tarifa de `proveedor_cobertura` para la comuna
  del comprador (con token de comprador; si no, la de su región, y sin sesión
  la RM). `null` si el proveedor no despacha a esa región.
- `proveedor.zona` (agregado en KAN-92): comuna y región de la dirección del
  distribuidor; `null` si no tiene dirección.
- `proveedor.calificacion` = `CalificacionRepository.resumenPorProveedor`.
- `404 PRODUCTO_NO_ENCONTRADO`.

## ✅ `GET /carro` · `PUT /carro` — KAN-130

Token de usuario de organización `cliente` (`403` si no). `PUT` reemplaza
todos los ítems (`reemplazarCarroSchema`):

```json
{ "items": [{ "ofertaId": 17, "cantidad": 24, "precioVisto": 1090 }] }
```

Respuesta de ambos (`detalleItems` en `carro.use-cases.ts`):

```json
{
  "id": 1, "estado": "abierto", "actualizadoEn": "2026-10-23T12:00:00.000Z",
  "items": [{
    "ofertaId": 17, "cantidad": 24, "precioVisto": 1090, "precioActual": 1090,
    "productoId": 9, "nombreProducto": "Leche entera", "formato": "Caja 1 L",
    "proveedorId": 2, "disponible": true, "cajasDisponibles": 20
  }]
}
```

Errores de `PUT`: `400 ITEM_DUPLICADO`, `404 OFERTA_NO_ENCONTRADA`,
`409 OFERTA_NO_DISPONIBLE` (`detalle.ofertaIds`). La app completa cada línea
con la ficha del catálogo (nombre del proveedor, plazo, mínimo, despacho,
ahorro). **Ojo con el seed**: el carro de El Fogón pide 24 cajas de leche y
la oferta tiene 20; la app lo marca y no deja pagar hasta ajustar.

## ✅ `GET /carro/opciones-entrega` — KAN-131, KAN-95

Token cliente. Direcciones guardadas de la organización y puntos de retiro
de los proveedores (los ids que piden `direccionId` y `retiros` de
`POST /carro/confirmar`).

```json
{
  "direcciones": [{
    "id": 6, "calle": "Av. Irarrázaval", "numero": "3450", "complemento": "Local 2",
    "referencia": "Entrada de proveedores por calle lateral", "comunaId": 20, "comuna": "Ñuñoa",
    "region": "Metropolitana de Santiago"
  }],
  "puntosRetiro": [{
    "id": 1, "proveedorId": 2, "nombre": "Bodega Quilicura",
    "horario": "Lun a Vie 08:00-17:00, Sáb 09:00-13:00",
    "direccion": "Av. Presidente Eduardo Frei Montalva 9650, Bodega 12, Quilicura"
  }]
}
```

Direcciones: las de la organización del token (la de su ficha y las usadas
en sus órdenes, incluidas las creadas con `direccion` en un checkout
anterior). Puntos de retiro: los activos de los proveedores del carro abierto.

## ✅ `GET /comunas` — KAN-131, KAN-95

Público. Para escribir una dirección nueva:
`[{ "id": 20, "nombre": "Ñuñoa", "regionCodigo": "13", "regionNombre": "Metropolitana de Santiago" }]`

## ✅ `POST /carro/confirmar` — KAN-131

Token cliente. Body (`confirmarCarroSchema`):

```json
{
  "direccionId": 6,
  "retiros": [{ "proveedorId": 2, "puntoRetiroId": 1 }],
  "requiereFactura": false
}
```

o `"direccion": { "comunaId": 23, "calle": "Av. Providencia", "numero": "2000" }`
en vez de `direccionId`. Respuesta `201`: orden `pendiente_pago`, un envío
por proveedor:

```json
{
  "ordenId": 12, "codigo": "CM-90012", "estado": "pendiente_pago",
  "subtotal": 67170, "costoDespachoTotal": 12980, "total": 80150,
  "envios": [{ "proveedorId": 2, "modalidad": "retiro", "plazoHoras": 24, "costoDespacho": 0, "subtotal": 21800, "lineas": [] }]
}
```

Errores `409` en este orden (`planificarOrden`): `CARRO_VACIO`,
`OFERTA_NO_DISPONIBLE`, `PRECIO_CAMBIO`, `MINIMO_COMPRA`, `SIN_STOCK`,
`PROVEEDOR_NO_DISPONIBLE`, `RETIRO_NO_DISPONIBLE`, `MODALIDAD_NO_DISPONIBLE`,
`SIN_COBERTURA`; `400 DIRECCION_REQUERIDA`. Nombre, RUT y correo que pide el
checkout **no** van en el body (el schema no los acepta): la factura sale de
los datos de la organización.

## ✅ `POST /ordenes/:id/pago` — KAN-95 (Webpay Plus; KAN-148)

Token cliente dueño de la orden. Crea la transacción en Webpay Plus por el
total de la orden y guarda el token en `orden.referencia_pasarela`.

Request: `{ "medioPago": "tarjeta" }` (default `tarjeta`; `transferencia` y
`linea_credito` responden `409 MEDIO_PAGO_NO_DISPONIBLE`, ver decisión abierta
16). Un `urlRetorno` en el body se ignora.

Response `201`:
`{ "ordenId": 12, "codigo": "CM-90012", "total": 80150, "pasarela": "webpay", "urlPago": "https://webpay3gint.transbank.cl/webpayserver/initTransaction", "token": "01ab…" }`

El cliente envía `token_ws=<token>` a `urlPago` con un **formulario POST**
(así lo pide Transbank). Webpay devuelve al comprador a
`GET|POST /pagos/webpay/retorno` en el backend (público), que confirma la
transacción, deja la orden `estado = pagada`, `estadoPago = pagado`,
`medioPago = tarjeta` y `pagadoEn` (o `estadoPago = fallido` si se rechazó o
anuló; la orden sigue `pendiente_pago` y se puede reintentar), emite los
documentos tributarios y redirige (303) a
`ECOMMERCE_URL/checkout/resultado?orden=12&pago=aprobado|rechazado|anulado|error`.
Cada reintento crea otra transacción (la orden de compra lleva un sufijo).
Errores: `409 ORDEN_YA_PAGADA`, `404 ORDEN_NO_ENCONTRADA`.

**Pendiente para la app:** el retorno va al ecommerce, no a la app. Hay que
registrar `cotizapp://` y que el retorno sepa a qué app volver (KAN-148).

## ✅ `GET /ordenes` · `GET /ordenes/:id` — KAN-132, KAN-136

`?estado=&pagina=&tamano=` (la app pide `tamano=100`). Forma de
`presentar()` en `ordenes.use-cases.ts`: el cliente ve sus órdenes sin
comisiones (`comisionPct`, `comisionMonto`, `montoALiquidar` y
`comisionTotal` en `null`); el proveedor ve solo su envío, sus montos y
`cliente: { nombre, organizacion }`.

```json
{
  "items": [{
    "id": 11, "codigo": "CM-10011", "estado": "pagada", "estadoPago": "pagado",
    "creadaEn": "2026-10-21T21:05:00.000Z", "pagadoEn": "2026-10-21T21:07:00.000Z",
    "requiereFactura": false, "medioPago": "tarjeta", "comuna": "Ñuñoa",
    "subtotal": 28920, "costoDespachoTotal": 5990, "comisionTotal": null, "total": 34910,
    "montoALiquidarTotal": null,
    "envios": [{
      "id": 21, "proveedorId": 3, "proveedorNombre": "Valle Central Mayorista", "modalidad": "despacho",
      "puntoRetiroId": null, "plazoHoras": 48, "costoDespacho": 5990, "subtotal": 28920,
      "comisionPct": null, "comisionMonto": null, "montoEnvio": 34910, "montoALiquidar": null,
      "estado": "por_despachar", "actualizadoEn": "2026-10-21T23:05:00.000Z"
    }]
  }],
  "pagina": 1, "tamano": 100, "total": 6, "totalPaginas": 1
}
```

`GET /ordenes/:id` agrega `direccionEntrega` y `lineas` por envío.

**⏳ Campos aditivos que pide la app en `GET /ordenes/:id`** (no rompen a
nadie; mientras no estén, la app los trata como desconocidos):

- ✅ `envios[].puntoRetiro`: `{ "id": 1, "nombre": "Bodega Quilicura", "horario": "...", "direccion": "..." }`
  o `null` (despacho). Solo en el detalle, desde KAN-96.
- `envios[].calificacion` (solo para el cliente): `{ "puntaje": 4, "comentario": "...", "creadaEn": "..." }`
  o `null`. Sin el campo, la app ofrece calificar y espera un `409 YA_CALIFICADO`.

## ✅ `PATCH /ordenes/envios/:id/estado` — KAN-136

Token proveedor (o admin). Body `{ "estado": "en_preparacion" }`. Respuesta
`{ "id": 21, "ordenId": 11, "estado": "en_preparacion", "ordenEstado": "en_preparacion" }`.
Transiciones (`transicionesPermitidas`): `por_despachar → en_preparacion →
despachado | listo_retiro → entregado`; cancelar desde los dos primeros.
Errores: `404 ENVIO_NO_ENCONTRADO` (también si es de otro proveedor),
`409 ORDEN_NO_PAGADA`, `409 ORDEN_REEMBOLSADA`, `409 TRANSICION_INVALIDA`
(`detalle.permitidas`).

## ⏳ `POST /ordenes/envios/:id/calificacion` — KAN-132

Token cliente. `CalificacionRepository.registrar` ya existe (KAN-142); falta
la ruta. Body (`registrarCalificacionSchema` sin `usuarioId`, que sale del
token): `{ "puntaje": 4, "comentario": "Buena cadena de frío" }`.

Response `201`:
`{ "id": 17, "ordenEnvioId": 19, "usuarioId": 9, "puntaje": 4, "comentario": "Buena cadena de frío", "creadaEn": "..." }`.
Errores (`CalificacionError`): `409 ENVIO_NO_CALIFICABLE`, `409 YA_CALIFICADO`,
`400 VALIDACION`.

## ⏳ `GET /estadisticas/proveedor/ventas` — KAN-133

Token proveedor (`ver_ordenes_propias`). `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`
(inclusivos; mismo `resolverRango` que `/estadisticas/proveedor`). Solo hay
que exponer `AnaliticaRepository.ventasPorSemana` y `ventasPorProducto`
(KAN-143), que ya existen: venta = envío no cancelado de orden con
`estado_pago = pagado`, fechado por `orden.creada_en`.

```json
{
  "desde": "2026-10-01", "hasta": "2026-10-31",
  "totales": { "envios": 3, "ventas": 218070, "despacho": 9980, "comision": 17446, "neto": 210604 },
  "semanas": [{ "semana": "2026-10-05", "envios": 1, "ventas": 84710, "despacho": 4990, "comision": 6777, "neto": 82923 }],
  "productos": [{ "productoId": 1, "nombre": "Aceite vegetal maravilla", "unidades": 12, "ventas": 149880 }]
}
```

La app lo llama tres veces: el mes elegido, el mismo tramo del mes anterior
(KPIs) y las últimas 12 semanas (gráfico y top de productos).

## ✅ `GET /estadisticas/proveedor` — KAN-134

Token proveedor. `?desde&hasta` (default últimos 30 días). Forma de
`estadisticasProveedor`:

```json
{
  "desde": "2026-08-21", "hasta": "2026-11-18",
  "totales": { "vistas": 1094, "clicks": 213 }, "conversionVistaClick": 0.1947,
  "porDia": [{ "fecha": "2026-09-01", "vistas": 12, "clicks": 3 }],
  "porOferta": [{ "ofertaId": 1, "productoId": 1, "producto": "Aceite vegetal maravilla", "vistas": 173, "clicks": 48, "conversionVistaClick": 0.2775, "porDia": [] }]
}
```

**⏳ Campo aditivo `porComuna`** ("clientes potenciales por ubicación"):

```json
"porComuna": [{ "comunaId": 20, "comuna": "Ñuñoa", "vistas": 140, "clicks": 31, "cubre": true }]
```

Mismas vistas y clicks que `porOferta`, agrupados por
`evento_analitico.comuna_id` (sin los NULL), ordenado por vistas desc.
`cubre` = el proveedor tiene `proveedor_cobertura` para esa comuna o su
región. Sin el campo, la app oculta esa sección.

## ✅ `POST /eventos/lote` — KAN-134

Público (token opcional), `202` sin cuerpo, 1 a 20 eventos, snake_case
(`eventoLoteSchema`). La app manda uno por request:

```json
{ "eventos": [{ "tipo_evento": "vista_producto", "sesion_id": "9f2c…", "producto_id": 1, "origen": "catalogo" }] }
```

También `busqueda` (`termino`, `resultados`) y `click_oferta` (`producto_id`,
`oferta_id`, `convirtio: false`) al agregar una oferta al carro. Si falla, la
app lo ignora.

## ⏳ `GET /calificaciones/recibidas` — KAN-135

Token proveedor. Usa `resumenPorProveedor` y `listarPorProveedor` (KAN-142)
más el `entregas_a_tiempo_pct` de la organización.

```json
{
  "resumen": { "promedio": 4.67, "cantidad": 6, "distribucion": { "1": 0, "2": 0, "3": 0, "4": 2, "5": 4 } },
  "entregasATiempoPct": 96.5,
  "items": [{
    "id": 15, "ordenEnvioId": 17, "ordenCodigo": "CM-10009", "cliente": "El Fogón",
    "puntaje": 5, "comentario": null, "creadaEn": "2026-10-15T15:45:00.000Z"
  }]
}
```

`items` de la más nueva a la más antigua; `cliente` = nombre de la
organización compradora (no el usuario); `promedio` y `entregasATiempoPct`
en `null` si no hay datos.

## ⏳ `GET /alertas/proveedor` — KAN-137

Token proveedor. Todo lo que la pestaña Alertas necesita en una llamada:

```json
{
  "documentos": [
    { "tipo": "carpeta_tributaria", "venceEn": null, "estado": "al_dia", "diasParaVencer": null },
    { "tipo": "resolucion_sanitaria", "venceEn": "2026-11-15", "estado": "vencido", "diasParaVencer": -3 }
  ],
  "stockBajo": [{ "ofertaId": 17, "productoId": 9, "producto": "Leche entera", "cajasDisponibles": 20, "cajasIniciales": 39 }],
  "porCobrar": {
    "entregadoSinLiquidar": 0, "liquidacionesPendientes": 97367, "total": 97367,
    "proximaLiquidacion": "2026-11-24"
  },
  "enviosPorDespachar": 1
}
```

- `documentos.estado` se calcula al consultar: `vencido` si `vence_en` ya
  pasó, `por_vencer` si vence en **45 días o menos**, si no `al_dia` (la
  columna `proveedor_documento.estado` del seed usa otra regla).
- `stockBajo`: ofertas `publicada` con `cajas_disponibles <= 20`.
- `porCobrar.entregadoSinLiquidar`: neto (subtotal + despacho − comisión) de
  envíos `entregado` sin `liquidacion_id`; `liquidacionesPendientes`: suma de
  `monto_neto` de liquidaciones `pendiente` (`/liquidaciones/mias` ya las
  lista); `proximaLiquidacion`: el próximo martes.
- `enviosPorDespachar`: envíos `por_despachar` de órdenes pagadas.
- Los umbrales (20 cajas, 45 días) son una decisión abierta: ver
  `docs/decisiones/DECISIONES-ABIERTAS.md`.

## Notas para backend

- `cantidad` del carro está en **cajas** y `planificarOrden` multiplica
  `precio_unitario × cantidad`, mientras el mockup del proveedor define
  "precio por unidad" y "unidades por caja". Ver decisión abierta en
  `docs/decisiones/DECISIONES-ABIERTAS.md`.
