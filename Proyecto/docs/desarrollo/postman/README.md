# Colección de Postman

Colección para probar a mano todos los endpoints del backend
(`apps/backend/src/routes/`), con bodies de ejemplo que pasan la validación
Zod y IDs del seed.

| Archivo | Qué es |
|---|---|
| `cotizapp-api.postman_collection.json` | La colección (formato v2.1). Se importa en Postman. |
| `generar-coleccion.py` | Script que genera el JSON. Es la fuente: se edita esto y se regenera, no el JSON a mano. |

## Usarla

1. Levantar el backend (`pnpm --filter @cotizapp/backend dev`, puerto 8000)
   con la base sembrada (ver [CUENTAS-DE-PRUEBA.md](../CUENTAS-DE-PRUEBA.md)).
2. Postman → **Import** → `cotizapp-api.postman_collection.json`.
3. Correr **0 · Sesión → Login admin**. Guarda el JWT en la variable
   `{{token}}`, que hereda toda la colección.
4. Para carro, órdenes propias, envíos y vistas de proveedor, correr también
   **Token dev · comprador El Fogón** y **Token dev · proveedor Los Andes**.

Las variables viven en la colección (pestaña *Variables*), no hace falta
environment:

| Variable | Default | Para qué |
|---|---|---|
| `baseUrl` | `http://localhost:8000` | Cambiarla para apuntar a otro servidor |
| `adminEmail`, `clave` | `admin@cotizapp.test`, `Cotizapp.2026` | Login; cualquier cuenta interna del seed sirve |
| `jwtSecret` | `dev-secret-not-for-prod` | Tiene que ser igual al `JWT_SECRET` del `.env` del backend |
| `token`, `desafio` | — | Los llena el login (y el MFA si aplica) |
| `tokenComprador`, `tokenProveedor` | — | Los llenan los requests *Token dev* |
| `productoId`, `ordenId`, `proveedorId`, ... | IDs del seed | Se cambian a mano según lo que se quiera probar |

## Por qué hay tokens firmados a mano

`POST /auth/admin/login` es el único login que existe y rechaza a cualquier
usuario cuya organización no sea `interna`. Los compradores y proveedores no
tienen cómo obtener un token todavía. Los requests *Token dev* firman en el
pre-request script de Postman un JWT HS256 con el mismo formato que
`lib/jwt.ts` (`sub`, `organizacionId`, `rol`) usando `{{jwtSecret}}`. Es lo
mismo que explica la [guía de CRUD](../crud/README.md) para `curl`.

Cuando exista el login de clientes, esos dos requests se reemplazan por
logins reales.

Los guards de permisos (`requirePermiso`) leen el rol desde la base, no del
JWT: el `rol` del token firmado a mano no da permisos extra, solo el `sub`
importa.

## Cuidado

- Si `DATABASE_URL` apunta a Aiven, los requests de escritura (crear,
  aprobar, pagar, reembolsar...) escriben en la base **compartida**. Para
  probar escrituras, usar el MySQL local de `docker compose`.
- Los requests de escritura cambian el estado del seed (un proveedor
  aprobado ya no se puede aprobar de nuevo, una liquidación pagada da 409).
  Para volver al estado inicial, re-sembrar.
- Los eventos analíticos tienen límite de tasa por IP (60 por minuto).

## Mantenerla

Al agregar o cambiar un endpoint, editar `generar-coleccion.py` en el mismo
cambio y regenerar:

```bash
python3 docs/desarrollo/postman/generar-coleccion.py
```

Imprime la cantidad de requests. Cada carpeta corresponde a un módulo de
`apps/backend/src/routes/` y su descripción indica el permiso que exige.
