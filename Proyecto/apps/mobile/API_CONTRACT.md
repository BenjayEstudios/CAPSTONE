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

Público. Árbol de 2 niveles plano (raíces con `padreId: null`).

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

## Notas para backend

- `POST /categorias` usa `requireRol("administrador")`, pero en el seed el
  código del rol es `admin_general` (`catalogo.ts`), así que con un token
  real ese guard rechazaría al admin.
