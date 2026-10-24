# CRUD, parte 2: rutas HTTP (`apps/backend`)

Pasos 5 a 7 de la [guía de CRUD](README.md). Viene de
[1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md).

La ruta solo hace cuatro cosas: validar la entrada, armar el repositorio con
`request.server.db`, llamar al caso de uso y traducir el resultado a un
status HTTP. Nada de lógica de negocio ni de Drizzle en el `handler`.

## Paso 5: una ruta por operación

> **Por qué así:** la ruta es el composition root del request (arma el repo y lo pasa) y solo traduce HTTP; sin reglas de negocio (C, D, E). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Un archivo por operación en `src/routes/categorias/`, cada uno exporta un
`RouteOptions` (convención completa en el
[README del proyecto](../../../README.md#convención-de-rutas-http)):

| Archivo | Método y URL | Auth | Respuestas |
|---|---|---|---|
| `list.ts` (existe) | `GET /categorias` | pública | 200 |
| `get.ts` | `GET /categorias/:id` | pública | 200, 404 |
| `create.ts` (existe) | `POST /categorias` | admin | 201, 400, 409 |
| `update.ts` | `PATCH /categorias/:id` | admin | 200, 400, 404, 409 |
| `delete.ts` | `DELETE /categorias/:id` | admin | 204, 404, 409 |

`PATCH` y no `PUT`: se manda solo lo que cambia.

El `:id` llega como string. Un schema compartido para todos los módulos, en
`src/lib/params.ts`:

```ts
import { z } from "zod";

// :id de la URL llega como string; z.coerce lo pasa a numero.
export const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });
```

`update.ts`, el caso más completo:

```ts
import type { RouteOptions } from "fastify";
import { actualizarCategoriaSchema, CategoriaError } from "@cotizapp/domain";
import { actualizarCategoria } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requireRol } from "../../plugins/auth.js";
import { idParamsSchema } from "../../lib/params.js";

export const updateCategoriaRoute: RouteOptions = {
  method: "PATCH",
  url: "/categorias/:id",
  preHandler: [requireAuth, requireRol("administrador")],
  handler: async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = actualizarCategoriaSchema.parse(request.body);
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    try {
      const actualizada = await actualizarCategoria({ categoriaRepository })(id, input);
      if (!actualizada) {
        return reply.status(404).send({ error: { code: "CATEGORIA_NO_ENCONTRADA", message: "La categoria no existe" } });
      }
      return actualizada;
    } catch (err) {
      if (err instanceof CategoriaError) {
        return reply.status(409).send({ error: { code: err.codigo.toUpperCase(), message: err.message } });
      }
      throw err;
    }
  }
};
```

- `get.ts` es lo mismo sin `preHandler`, sin body y sin `try`.
- `delete.ts` responde `return reply.status(204).send();` si
  `eliminarCategoria` devolvió `true`, y 404 si devolvió `false`.
- Se agregan al arreglo de `categorias/index.ts`:
  `[listCategoriasRoute, getCategoriaRoute, createCategoriaRoute, updateCategoriaRoute, deleteCategoriaRoute]`.
  `routes/index.ts` ya incluye `...categoriaRoutes`; para un módulo nuevo
  se agrega su arreglo ahí.

### Quién puede llamar cada ruta

- Lectura pública: sin `preHandler`.
- Escritura: `preHandler: [requireAuth, requireRol(...)]`. `requireAuth`
  deja en `request.auth` los claims del token (`sub`, `organizacionId`,
  `rol`).
- Si la operación depende de quién la hace (un proveedor editando *su*
  oferta), la ruta pasa `request.auth.organizacionId` al caso de uso, y el
  caso de uso filtra por él. Nunca se toma la organización del body.

Detalle en el
[README del proyecto](../../../README.md#autenticación-y-autorización-en-las-rutas).

## Paso 6: errores 400, 404 y 409

> **Por qué así:** las capas de adentro avisan en su idioma, la capa HTTP lo convierte en status con un formato único para los tres clientes (D, F). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Todas las respuestas de error tienen la misma forma, que es la que
interpretan mobile y los frontends:

```json
{ "error": { "code": "CATEGORIA_NO_ENCONTRADA", "message": "La categoria no existe" } }
```

| Status | Cuándo | Quién lo produce |
|---|---|---|
| 400 `VALIDATION_ERROR` | body o params no pasan el schema de zod | `setErrorHandler` (ver abajo) |
| 401 / 403 | sin token / sin el rol | `requireAuth` / `requireRol` |
| 404 | el repositorio devolvió `null`/`false` | la ruta |
| 409 | error de dominio (`CategoriaError`: slug repetido, categoría en uso) | la ruta |
| 500 | cualquier otra cosa | `setErrorHandler` |

**Pendiente, hacerlo una vez:** hoy un `ZodError` cae en el `500` porque
`setErrorHandler` (`src/server/app.ts`) solo mira `error.statusCode`. Hay que
agregar al inicio del handler:

```ts
import { ZodError } from "zod";

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      const message = error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message } });
    }
    // ... lo que ya está
  });
```

Hay una sola versión de zod en el monorepo, así que el `instanceof` reconoce
también los errores lanzados desde `@cotizapp/domain`.

Si los errores de dominio empiezan a repetirse en muchos módulos, conviene
que extiendan una clase base común y mapearla a 409 una sola vez en
`setErrorHandler`, en vez de un `try/catch` por ruta.

## Paso 7: probar con curl

> **Por qué así:** la API tiene que ser correcta sin ninguna pantalla (E). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

**Antes, mirar `DATABASE_URL` en `apps/backend/.env`.** Si apunta a Aiven,
los `POST`/`PATCH`/`DELETE` escriben en la base compartida del equipo.
Para probar escrituras, usar el MySQL local (`docker compose up -d mysql`,
migrado y con el seed).

Como todavía no existe `POST /auth/login` (KAN-144), el token se firma a
mano con el mismo `JWT_SECRET` del backend:

```bash
cd Proyecto/apps/backend
TOKEN=$(node --env-file=.env -e "console.log(require('jsonwebtoken').sign({ sub: '1', organizacionId: 1, rol: 'administrador' }, process.env.JWT_SECRET, { expiresIn: '1h' }))")
```

(`sub: '1'` y `organizacionId: 1` son el admin y la organización Cotizapp
del seed. El rol va como `administrador` porque es lo que pide hoy
`requireRol`; ver decisión abierta #1.)

```bash
API=http://localhost:8000

curl $API/categorias
curl $API/categorias/1

curl -X POST $API/categorias -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"nombre":"Prueba","slug":"prueba"}'

ID=16   # el "id" que devolvió el POST

curl -X PATCH $API/categorias/$ID -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"estado":"oculta"}'

curl -i -X DELETE $API/categorias/$ID -H "Authorization: Bearer $TOKEN"
```

- En el `DELETE` no va `Content-Type: application/json`: Fastify rechaza
  un body JSON vacío.
- `-i` muestra el status; útil para confirmar 204/404/409.
- Casos que conviene probar: id que no existe (404), slug repetido (409),
  body vacío en `PATCH` (400), sin token (401), borrar una categoría con
  productos (409).

Sigue en [3-FRONTEND-BASE.md](3-FRONTEND-BASE.md).
