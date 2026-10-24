# Contrato de API — app mobile

Endpoints de `apps/backend` que necesita `apps/mobile`. Mientras un endpoint
no exista, la app usa un datasource fake que devuelve **exactamente** el
JSON descrito acá (armado con los datos del seed), así que al implementarlo
basta con respetar esta forma y correr la app con `--dart-define=USE_FAKES=false`.

Estado: ✅ existe en el backend · ⏳ pendiente (la app usa fake).

## Convenciones

- **Base URL**: `http://localhost:8000` (emulador Android: `http://10.0.2.2:8000`).
- **JSON en camelCase**, igual que las entidades de `@cotizapp/domain`
  (ej. `padreId`, `precioUnitario`).
- **Montos**: enteros en CLP, sin decimales (como `int unsigned` en el schema).
- **Fechas**: string ISO 8601 (`2026-10-20T17:40:00.000Z`).
- **IDs**: number, los mismos del seed.
- **Auth**: rutas protegidas reciben `Authorization: Bearer <token>`; el
  token es el JWT que ya valida `plugins/auth.ts` (claims `sub`,
  `organizacionId`, `rol`).
- **Errores**: el formato que ya usa el backend:

  ```json
  { "error": { "code": "UNAUTHORIZED", "message": "Falta el token" } }
  ```

  La app muestra `message` al usuario y decide por status: 401 → vuelve al
  login, 403 → sin permiso, 404 → no encontrado, 400/409/422 → error de
  validación, resto → error de servidor.

## Endpoints

### ✅ `GET /health-check`

Público. Lo usa la pantalla de diagnóstico **Conexión**.

```json
{ "status": "ok", "timestamp": "2026-10-23T15:00:00.000Z" }
```

### ✅ `GET /categorias`

Público. Árbol de 2 niveles plano (raíces con `padreId: null`). La app
lo usa para el inicio, los filtros y las migas de la ficha, y descarta las
que vienen con `estado: "oculta"`.

```json
[
  { "id": 1, "padreId": null, "nombre": "Abarrotes", "slug": "abarrotes", "orden": 1, "estado": "activa" },
  { "id": 8, "padreId": 1, "nombre": "Aceites", "slug": "aceites", "orden": 1, "estado": "activa" }
]
```

### ⏳ `POST /auth/login` — KAN-126

Público. Valida contra `usuario.email` + `usuario.hash_clave` (bcrypt) y
emite el JWT que ya verifica `plugins/auth.ts`, con claims
`{ sub: "<usuario.id>", organizacionId, rol: "<rol.codigo>" }`. El mismo
endpoint sirve a admin-site: el backend no filtra por rol; la app mobile
rechaza por su cuenta los roles internos (`admin_general`,
`editor_catalogo`, `soporte`).

Request:

```json
{ "email": "compras@elfogon.test", "clave": "Cotizapp.2026" }
```

Response `200`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 8,
    "nombre": "Compras El Fogón",
    "email": "compras@elfogon.test",
    "rol": "comprador",
    "organizacion": { "id": 6, "nombre": "El Fogón", "tipo": "cliente" }
  }
}
```

- `usuario.rol` = `rol.codigo` (`comprador`, `proveedor`, `admin_general`, ...).
- `organizacion.nombre` = `nombre_fantasia` (o `razon_social` si es NULL).
- `organizacion.tipo` = `cliente` | `proveedor` | `interna`.
- El email se compara sin distinguir mayúsculas (la app lo manda con `trim()`).

Errores:

| Status | `code` | Cuándo | `message` que muestra la app |
|---|---|---|---|
| 401 | `CREDENCIALES_INVALIDAS` | email no existe o clave no calza (mismo error para ambos) | `Correo o clave incorrectos.` |
| 403 | `USUARIO_NO_ACTIVO` | `usuario.estado` ≠ `activo` u `organizacion.estado` ≠ `activa` (ej. `contacto@laspalmas.test`, invitado y en revisión) | `Tu cuenta todavía no está activa. Te avisaremos cuando se apruebe.` |
| 400 | `VALIDATION_ERROR` | body sin `email` o `clave` | — |

La sesión es stateless: no hace falta `POST /auth/logout` (la app borra el
token del dispositivo). Cuando el JWT expira, cualquier ruta protegida debe
responder **401**; la app lo detecta y vuelve al login.

### ⏳ `GET /productos` — KAN-127, KAN-128

Público. Listado y búsqueda del catálogo: cada producto con el rango de
precios de sus ofertas visibles. **Oferta visible** = `oferta.estado =
'publicada'` y `organizacion.estado = 'activa'` del proveedor (deja fuera la
palta y el tomate de Las Palmas, en borrador y en revisión, y la bebida
pausada de Valle Central). Un producto sin ofertas visibles no aparece.

Query params (todos opcionales):

| Param | Ejemplo | Regla |
|---|---|---|
| `q` | `aceite` | Busca en `nombre` (FULLTEXT `ix_producto_nombre_fulltext`) y `marca`, sin distinguir mayúsculas ni tildes |
| `categoriaId` | `1` | Esa categoría **y sus subcategorías** (1 = Abarrotes incluye Aceites y Arroz y legumbres) |
| `plazoMaxHoras` | `24` | Solo cuentan las ofertas con `plazo_horas <= 24` |
| `maxUnidadesPorCaja` | `6` | Solo cuentan las ofertas con `unidades_por_caja <= 6` ("caja chica") |
| `orden` | `precio` | `relevancia` (default), `precio` (precioDesde asc), `diferencia` (precioHasta - precioDesde desc, **solo productos con 2+ ofertas**), `nombre` |
| `pagina` / `porPagina` | `1` / `50` | Paginación; default `1` / `20` |

`plazoMaxHoras` y `maxUnidadesPorCaja` filtran **ofertas**: el producto
aparece si al menos una oferta cumple, y `precioDesde`, `precioHasta`,
`ofertas` y `plazoMinHoras` se calculan solo con esas.

Response `200`:

```json
{
  "items": [
    {
      "id": 1,
      "sku": "ACE-0001",
      "nombre": "Aceite vegetal maravilla",
      "marca": "Belmont",
      "formato": "Bidón 5 L",
      "contenido": 5,
      "unidad": "L",
      "categoriaId": 8,
      "imagenUrl": null,
      "precioDesde": 12490,
      "precioHasta": 12890,
      "ofertas": 2,
      "plazoMinHoras": 24
    }
  ],
  "total": 17,
  "pagina": 1,
  "porPagina": 50
}
```

- `contenido` como **number** (en la tabla es `decimal(10,3)`, que mysql2 devuelve como string: convertir).
- `unidad` = `kg` | `L` | `unidad`. La app calcula el precio por kg/L con `precio / contenido`.
- `imagenUrl` = la imagen con `es_principal` de `producto.imagenes`, o `null` (hoy todas son NULL, KAN-157).
- Solo productos con `estado = 'publicado'`.

El inicio usa `GET /productos?orden=diferencia&porPagina=5` para "Mayor
diferencia de precio hoy".

### ⏳ `GET /productos/:id` — KAN-129

Público. Ficha con el comparador: todas las ofertas visibles (mismo
criterio que arriba) **ordenadas por `precioUnitario` ascendente**, cada una
con los datos del proveedor y su calificación.

Query param `origen` = `catalogo` | `busqueda` | `directo`: de dónde viene
la visita. Sugerencia: registrar aquí el `evento_analitico` de tipo
`vista_producto` con ese `origen` (lo van a leer las visitas y conversión
del distribuidor, KAN-134).

Response `200`:

```json
{
  "id": 1,
  "sku": "ACE-0001",
  "nombre": "Aceite vegetal maravilla",
  "marca": "Belmont",
  "formato": "Bidón 5 L",
  "contenido": 5,
  "unidad": "L",
  "categoriaId": 8,
  "imagenUrl": null,
  "descripcion": null,
  "precioReferencia": 12990,
  "categoria": {
    "id": 8,
    "nombre": "Aceites",
    "padre": { "id": 1, "nombre": "Abarrotes" }
  },
  "ofertas": [
    {
      "id": 1,
      "precioUnitario": 12490,
      "unidadesPorCaja": 4,
      "cajasDisponibles": 40,
      "minimoCompra": 1,
      "plazoHoras": 24,
      "modalidadEntrega": "ambos",
      "notasCliente": null,
      "proveedor": {
        "id": 2,
        "nombre": "Los Andes Food Service",
        "entregasATiempoPct": 96.5,
        "despachoGratisDesde": 150000,
        "costoDespacho": 4990,
        "calificacion": { "promedio": 4.67, "cantidad": 6 }
      }
    }
  ]
}
```

- `categoria.padre` es `null` si la categoría del producto ya es raíz (ej. Huevos, categoría 2).
- `proveedor.nombre` = `nombre_fantasia` (o `razon_social`).
- `proveedor.costoDespacho` = `proveedor_cobertura.costo_despacho` para la región del comprador. Si no hay comprador logueado o no se conoce su comuna, la tarifa de la RM (todos los clientes del seed están en la RM).
- `proveedor.calificacion` = lo que devuelve `CalificacionRepository.resumenPorProveedor` (KAN-142): `promedio` es `null` y `cantidad` es `0` si no tiene calificaciones. Con el seed: Los Andes 4,67 (6), FrigoSur 4,4 (5), Valle Central 3,8 (5).
- `entregasATiempoPct` como number (es `decimal(5,2)`).

Errores: `404` `PRODUCTO_NO_ENCONTRADO` si no existe o no está publicado.

## Notas para backend

- `POST /categorias` usa `requireRol("administrador")`, pero en el seed el
  código del rol es `admin_general` (`catalogo.ts`), así que con un token
  real ese guard rechazaría al admin.
