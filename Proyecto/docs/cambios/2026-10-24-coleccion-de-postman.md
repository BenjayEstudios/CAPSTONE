# Colección de Postman de la API

**Fecha:** 2026-10-24 · **Épica:** KAN-88 · **Ticket:** —

Nueva carpeta `docs/desarrollo/postman/` con una colección de Postman que
cubre las 60 rutas del backend en 17 carpetas (una por módulo de
`apps/backend/src/routes/`), con bodies de ejemplo que pasan la validación
Zod de `@cotizapp/domain` y variables con IDs del seed.

- El request *Login admin* guarda el JWT en `{{token}}` y toda la colección
  lo hereda como bearer. Si la cuenta tiene MFA activo, guarda `{{desafio}}`
  para el segundo paso.
- Dos requests *Token dev* firman localmente un JWT de comprador (El Fogón)
  y de proveedor (Los Andes), porque el único login que existe
  (`/auth/admin/login`) rechaza organizaciones externas. Los usan carro,
  órdenes propias, cambio de estado de envío, liquidaciones propias y
  estadísticas del proveedor.
- La colección la genera `generar-coleccion.py`, para que agregar un
  endpoint sea editar un script legible y no un JSON de miles de líneas.

No cambia código. No se probó contra un backend corriendo: los bodies y
permisos salen de los schemas y de los `preHandler` de cada ruta.

**Por qué**: probar endpoints a mano requería leer cada ruta para saber el
body, el permiso y cómo conseguir un token.

**Archivos:**

- `docs/desarrollo/postman/README.md`
- `docs/desarrollo/postman/cotizapp-api.postman_collection.json`
- `docs/desarrollo/postman/generar-coleccion.py`
- `docs/desarrollo/README.md` (índice)
