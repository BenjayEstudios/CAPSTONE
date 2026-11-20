# Cómo hacer un CRUD de punta a punta

Guía para agregar las cinco operaciones (listar, obtener, crear, actualizar,
eliminar) de una entidad, desde la tabla MySQL hasta la pantalla Angular,
respetando la arquitectura del proyecto.

El ejemplo es **`categoria`**: `GET /categorias` y `POST /categorias` ya
existen, y lo que falta (obtener, actualizar, eliminar y la pantalla) es
justo lo que pide KAN-118 en `admin-site`. Para otra entidad (`producto`,
`oferta`…) se repite el mismo recorrido cambiando el nombre.

**¿Primera vez?** Lee antes [RESUMEN-Y-PORQUE.md](RESUMEN-Y-PORQUE.md): la
guía entera en una página, sin código, con el porqué de cada paso.

Se lee en orden: primero este índice (entender el recorrido y preparar el
entorno), después los cuatro archivos numerados, de adentro hacia afuera.
Cada paso compila apoyándose en el anterior, así que conviene no saltarse
ninguno.

## Antes de empezar: el recorrido de un request

Qué pasa cuando alguien edita una categoría en admin-site:

```
admin-site (Angular, :4300)
  categoria-form.component  ──guardar()──▶  CategoriasService.actualizar(id, datos)
                                              └─▶ ApiClient.patch("/categorias/3", datos)
                                                    └─▶ authInterceptor agrega "Authorization: Bearer <jwt>"
        │
        │  PATCH http://localhost:8000/categorias/3   { "nombre": "Lácteos" }
        ▼
apps/backend (Fastify, :8000)
  routes/categorias/update.ts
    preHandler: requireAuth → requireRol(...)        401 / 403 si no corresponde
    handler:  zod valida params y body               400 si viene mal
              new DrizzleCategoriaRepository(request.server.db)
              actualizarCategoria({ categoriaRepository })(id, datos)
        │
        ▼
packages/application   actualizarCategoria       reglas de negocio, valida de nuevo
        │                                         (solo conoce la interfaz del repo)
        ▼
packages/domain        CategoriaRepository       la interfaz (el "puerto")
        ▲
        │ implements
packages/infrastructure  DrizzleCategoriaRepository  UPDATE categoria SET ... (Drizzle → MySQL)
        │
        ▼
  respuesta: 200 { id, nombre, slug, ... }  o  404/409 { "error": { "code", "message" } }
```

Regla de dependencia que no se rompe nunca:
`apps/backend → application → domain ← infrastructure`. `domain` no importa
Drizzle ni MySQL; `application` no sabe que existe HTTP ni JWT; las apps
Angular solo hablan HTTP con el backend (nunca importan `application` ni
`infrastructure`).

## Los pasos

| Paso | Qué se hace | Dónde |
|---|---|---|
| 0 | Preparar el entorno | [abajo](#paso-0-preparar-el-entorno) |
| 1 | **Domain**: entidad, error de dominio, DTO (zod) y la interfaz del repositorio | [1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md#paso-1-domain-entidad-error-dto-y-puerto) |
| 2 | **Application**: un caso de uso por operación | [1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md#paso-2-application-un-caso-de-uso-por-operación) |
| 3 | **Infrastructure**: el repositorio Drizzle que implementa la interfaz | [1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md#paso-3-infrastructure-el-repositorio-drizzle) |
| 4 | Test del repositorio contra el MySQL local | [1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md#paso-4-test-del-repositorio) |
| 5 | **Backend**: un archivo de ruta por operación, con su auth | [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-5-una-ruta-por-operación) |
| 6 | Errores 400 / 404 / 409 con el formato común | [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-6-errores-400-404-y-409) |
| 7 | Probar la API con `curl` (antes de tocar el frontend) | [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-7-probar-con-curl) |
| 8 | **Frontend**: completar `ApiClient` (post/patch/delete) | [3-FRONTEND-BASE.md](3-FRONTEND-BASE.md#paso-8-completar-apiclient) |
| 9 | Mandar el token en cada request | [3-FRONTEND-BASE.md](3-FRONTEND-BASE.md#paso-9-mandar-el-token-provisorio-hasta-kan-144--kan-166) |
| 10 | Modelo y servicio de la feature | [3-FRONTEND-BASE.md](3-FRONTEND-BASE.md#paso-10-modelo-y-servicio) |
| 11 | Rutas lazy, pantalla de lista y formulario | [4-FRONTEND-PANTALLAS.md](4-FRONTEND-PANTALLAS.md#paso-11-rutas-y-pantallas) |
| 12 | Test del servicio | [4-FRONTEND-PANTALLAS.md](4-FRONTEND-PANTALLAS.md#paso-12-test-del-servicio) |
| 13 | Probarlo entero en el navegador | [4-FRONTEND-PANTALLAS.md](4-FRONTEND-PANTALLAS.md#paso-13-probarlo-en-el-navegador) |
| 14 | Documentar el cambio | [abajo](#paso-14-documentar) |

**Al terminar cada paso de `packages/`, exportar en su `index.ts`**
(`entities/`, `dtos/`, `repositories/`, `use-cases/`). Si falta el export,
el import desde `@cotizapp/...` falla aunque el archivo exista.

## Paso 0: preparar el entorno

1. MySQL local con el esquema y los datos de prueba (las pruebas de
   escritura no se hacen contra Aiven, que es la base compartida):

   ```bash
   cd Proyecto
   docker compose up -d mysql
   pnpm --filter @cotizapp/infrastructure db:migrate
   pnpm --filter @cotizapp/infrastructure db:seed
   ```

2. Confirmar que `DATABASE_URL` en `apps/backend/.env` apunta a ese MySQL
   local y no a Aiven.
3. Levantar todo con `pnpm dev` (o `docker compose up`). Así Turborepo
   recompila `domain`, `application` e `infrastructure` al guardar y
   reinicia el backend solo. Con `pnpm --filter @cotizapp/backend dev` a
   secas, los cambios en `packages/` no se ven hasta hacer `pnpm build`.
4. ¿La tabla ya existe? El modelo completo está en
   `packages/infrastructure/src/db/schema/`, así que casi siempre sí. Si hay
   que cambiarla: `pnpm db:generate` + `pnpm db:migrate`, nunca
   `drizzle-kit push` ([OPERAR-LA-BASE.md](../OPERAR-LA-BASE.md)).

## Paso 14: documentar

En el mismo PR que el código:

- Entrada en [docs/cambios/](../../cambios/README.md) y en su índice (los
  cambios de API van ahí).
- El endpoint en [`apps/mobile/API_CONTRACT.md`](../../../apps/mobile/API_CONTRACT.md)
  si mobile lo va a usar.
- El estado del ticket en su archivo de [docs/epicas/](../../epicas/README.md)
  y en la tabla del índice.

## Trampas conocidas (estado al 2026-10-24)

- **Un body inválido hoy devuelve 500, no 400.** El `setErrorHandler` de
  `apps/backend/src/server/app.ts` no reconoce `ZodError`. El arreglo (una
  vez, para todas las rutas) está en
  [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-6-errores-400-404-y-409).
- **`requireRol("administrador")` no calza con el seed**, donde el rol se
  llama `admin_general`. Con un token firmado a mano se prueba igual; está
  en [decisiones abiertas](../../decisiones/DECISIONES-ABIERTAS.md) (#1).
- **No hay login todavía** (`POST /auth/login`, KAN-144). Para las rutas
  protegidas hay que firmar un JWT a mano: ver
  [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-7-probar-con-curl).
- **`ApiClient` solo tiene `get`** y no hay interceptor de auth (KAN-166).
  Cómo agregarlos: [3-FRONTEND-BASE.md](3-FRONTEND-BASE.md#paso-8-completar-apiclient).
- **Fastify vs Express** sigue abierto (KAN-169). Si se migra, cambian solo
  los archivos de `apps/backend/src/routes/`; las tres capas de `packages/`
  quedan igual.
