# apps/backend

Backend Fastify + TypeScript. Es la **capa de interfaz HTTP**: expone rutas
que llaman a los casos de uso de `@cotizapp/application`, ya conectados a sus
dependencias reales en el composition root.

## Estructura

```
src/
├── server/
│   ├── index.ts   # entrypoint: carga env, arma la app, escucha el puerto
│   └── app.ts      # buildApp(): composition root — arma repos de
│                    infrastructure, los pasa a los casos de uso de
│                    application, registra plugins y el error handler
├── routes/          # un grupo de rutas por módulo de negocio
│   ├── auth/          # (pendiente)
│   ├── catalogo/       # (pendiente)
│   ├── pedidos/        # (pendiente)
│   └── pagos/           # (pendiente)
├── plugins/          # plugins de Fastify (auth, rate-limit, etc.)
├── config/
│   └── env.ts        # validación de variables de entorno con zod
└── types/
    └── fastify.d.ts   # augmentation de FastifyInstance (decorators)
```

## Cómo correrlo

```bash
cp .env.example .env
pnpm dev            # tsx watch, puerto 3000 por defecto
pnpm test
pnpm build && pnpm start
```

## Dónde va cada cosa

- **Lógica de negocio** (casos de uso) → `packages/application`, no acá.
- **Entidades/DTOs/interfaces de repositorio** → `packages/domain`, no acá.
- **Acceso a MySQL/Drizzle** → `packages/infrastructure`, no acá.
- Acá solo va: parseo de request/response, wiring de dependencias (composition
  root), middlewares/plugins HTTP, manejo de errores.

## Manejo de errores

`app.ts` registra un `setErrorHandler` centralizado que devuelve
`{ error: { code, message } }` con el status HTTP correspondiente.

## Autorizacion por permisos

`requirePermiso(...requisitos)` (`src/plugins/auth.ts`) se compone despues de
`requireAuth`. Lee el rol y el estado del usuario desde la DB en cada request
(no del JWT) y evalua la matriz `rol.permisos`. 401 si el usuario no existe o
no esta activo; 403 `FORBIDDEN` si el nivel es `ninguno`/ausente. Acepta
`"codigo"` (parcial o total) o `{ codigo, minimo: "total" }`; basta cumplir uno.

| Ruta | Requisito |
| --- | --- |
| POST/PATCH `/productos`, POST/PATCH `/categorias` | `crear_producto` |
| GET `/productos`, GET `/productos/:id`, GET `/categorias?incluirOcultas=true` | `crear_producto` o `cargar_imagenes` en `total` |
| PUT `/productos/:id/imagenes`, POST `/productos/:id/imagenes/archivo` | `cargar_imagenes` en `total` |

`cargar_imagenes: parcial` (rol proveedor) no basta: no hay modelo de
pertenencia producto-proveedor todavia.

## Subida de imagenes de producto

`POST /productos/:id/imagenes/archivo` (multipart, un archivo): valida firma
binaria JPG/PNG, tamano maximo y ancho minimo 1200 px; genera el nombre en el
servidor y responde `201 { url, clave, ancho, alto }`. No registra la imagen:
el cliente llama despues a `PUT /productos/:id/imagenes` con esos metadatos.
Los archivos se sirven (solo lectura, sin listado) en `/uploads/...`.

Variables de entorno:

| Variable | Default | Descripcion |
| --- | --- | --- |
| `CORS_ORIGIN` | `http://localhost:4200,http://localhost:4300` | Origenes permitidos por CORS; admite una lista separada por comas (se toleran espacios). |
| `STORAGE_DRIVER` | `local` | Adaptador de `AlmacenArchivos`. Hoy solo `local`. |
| `UPLOADS_DIR` | `./uploads` | Directorio de archivos (docker-compose: `/data/uploads`, volumen `backend-uploads`). |
| `UPLOADS_MAX_MB` | `5` | Tamano maximo por archivo. |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Base absoluta de las URL devueltas. |

Extension a DigitalOcean Spaces (no implementado): crear `AlmacenSpaces`
(S3-compatible) en `packages/infrastructure` que implemente `AlmacenArchivos`
(`packages/domain/src/services`), agregar `spaces` a `STORAGE_DRIVER` y un
`case` en `src/lib/storage.ts`.
