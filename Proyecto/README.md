# Cotizapp

Ecommerce centralizado de cotización y compra multiproveedor para
pymes/emprendedores del rubro alimenticio: comparar precio, tiempo de
entrega y calificación entre distribuidores, armar un carrito multiproveedor
y pagar todo en una sola transacción. Proyecto de Título (APT) — Duoc UC,
Ingeniería en Informática.

## Stack

- **Web**: Angular + TypeScript — una sola app para clientes y distribuidores (`apps/web`).
- **Mobile**: Flutter + Riverpod + go_router, exclusiva para distribuidores (`apps/mobile`).
- **Backend**: Fastify + TypeScript + Drizzle ORM + MySQL (`apps/rest`).
- **Infraestructura**: Digital Ocean, un droplet con Docker (Nginx + API + MySQL) — ver `infra/`.
- **Monorepo**: pnpm workspaces + Turborepo.

La arquitectura de capas (domain → application → infrastructure) y las
decisiones de diseño están documentadas en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
El modelo de datos completo (DBML) vive en [DataBase/dbDiagram.sql](DataBase/dbDiagram.sql).

## Requisitos

- Node.js >= 22.13 y pnpm (`corepack enable`) — el `packageManager` del repo es `pnpm@11.17.0`, que exige Node ≥22.13.
- Docker + Docker Compose (para MySQL, y opcionalmente para correr todo el stack).
- Angular CLI (`pnpm add -g @angular/cli`) si vas a trabajar en `apps/web` fuera de Docker.
- Flutter SDK para `apps/mobile` (no está en Docker, se corre aparte).

## Levantar el entorno

Hay dos formas de levantar backend + frontend + base de datos. Ambas leen
las mismas variables de `apps/rest/.env` / `apps/web/.env`.

### Opción A — Docker Compose (recomendado para empezar rápido)

Un solo comando levanta MySQL, el backend y el frontend juntos, con
hot-reload en los tres (ver [¿Cómo funciona el hot-reload?](#cómo-funciona-el-hot-reload) más abajo):

```bash
cp apps/rest/.env.example apps/rest/.env      # o pide el .env real a Infraestructura
docker compose up
```

- Backend: http://localhost:8000
- Frontend: http://localhost:4200
- MySQL: localhost:3306 (user/pass `cotizapp`/`cotizapp`, db `cotizapp`)

La primera vez tarda 1-2 minutos: cada contenedor corre `pnpm install` y
compila los paquetes del monorepo adentro. Las siguientes veces es rápido
(node_modules queda cacheado en volúmenes Docker).

Comandos útiles:

```bash
docker compose up -d              # todo en background
docker compose logs -f            # logs de todo, en vivo
docker compose logs -f rest       # logs solo del backend
docker compose logs -f web        # logs solo del frontend
docker compose ps                 # qué está corriendo
docker compose down               # apagar todo
```

Si cambias algo en `apps/rest/.env`, `apps/web/.env` o en `docker-compose.yml`,
no hace falta bajar todo el stack — recrea solo el servicio afectado:

```bash
docker compose up -d rest         # recrea solo el backend (detecta el .env nuevo)
docker compose up -d web          # recrea solo el frontend
```

Si solo quieres reiniciar el proceso sin cambios de config:
`docker compose restart rest`.

### Opción B — Todo local, sin Docker para las apps (Docker solo para MySQL)

```bash
pnpm install
docker compose up -d mysql

cp apps/rest/.env.example apps/rest/.env
cp packages/infrastructure/.env.example packages/infrastructure/.env

pnpm dev   # corre TODO en paralelo vía Turborepo: rest, web, y el watch de domain/application/infrastructure

# o por separado:
pnpm --filter=@cotizapp/rest dev   # backend en :8000
pnpm --filter=@cotizapp/web dev    # web en :4200

cd apps/mobile && flutter pub get && flutter run
```

### Migraciones de base de datos

El schema vive en `packages/infrastructure/src/db/schema` (Drizzle). Cada vez
que agregues/cambies una tabla ahí:

```bash
cd packages/infrastructure
pnpm db:generate   # genera el SQL de migración en migrations/
pnpm db:migrate    # la aplica contra DATABASE_URL
```

## Variables de entorno

- `apps/rest/.env` — configuración del backend (puerto, DB, JWT, CORS, etc.). Hay `.env.example`, `.env.dev` y `.env.prod` de referencia — cada variable tiene un comentario explicando para qué sirve. La única variable de base de datos que el código realmente lee es `DATABASE_URL` (`apps/rest/src/config/env.ts`); las `DB_HOST`/`DB_PORT`/`DB_USER`/etc. desglosadas son solo informativas.
- `apps/web/.env` — **ojo**: este archivo no lo lee Angular (Angular no soporta `.env` nativo). La config real del frontend vive en `apps/web/src/environments/environment.ts` (producción) y `environment.development.ts` (dev). Si necesitas cambiar la URL de la API en desarrollo, edita `environment.development.ts`, no `.env`.
- Nunca se commitean (`.env` y `.env.*` están en `.gitignore`, excepto `.env.example`). Pide el `.env` real a Infraestructura o arma el tuyo copiando el `.example`.

## ¿Cómo funciona el hot-reload?

- **Backend** (`apps/rest`): `tsx watch` reinicia el proceso al guardar algo en `apps/rest/src`. Si tocas `packages/domain`, `packages/application` o `packages/infrastructure` (que `rest` importa como dependencias compiladas, no como código fuente), Turborepo compila esos paquetes en modo watch (`tsc -b --watch`) y `tsx watch` está configurado para vigilar también sus `dist/`, así que **también reinicia el backend**.
- **Frontend** (`apps/web`): `ng serve` (Vite) hace hot-reload automático de cualquier archivo bajo `apps/web/src`, incluyendo `environment.development.ts`.
- **Variables de entorno**: si cambias `apps/rest/.env`/`apps/web/.env`, el proceso *no* se entera solo — hay que recrear el contenedor (`docker compose up -d rest`) o reiniciar el proceso local.

## Cómo agregar una funcionalidad nueva (ejemplo de referencia: `categoria`)

Para que quede claro cómo se conectan las capas, ya hay un caso de uso
completo implementado de punta a punta — **listar y crear categorías** — que
pueden usar como plantilla al agregar cualquier feature nueva (`producto`,
`oferta`, `carro`, etc.). Recorrido de archivos, en el orden en que
conviene escribirlos:

1. **Entidad de dominio** — [`packages/domain/src/entities/categoria.entity.ts`](packages/domain/src/entities/categoria.entity.ts)
   El tipo puro de la categoría, sin nada de Drizzle/MySQL.

2. **DTO + validación** — [`packages/domain/src/dtos/categoria.dto.ts`](packages/domain/src/dtos/categoria.dto.ts)
   Schema de Zod (`crearCategoriaSchema`) que valida la entrada. Se comparte
   entre el caso de uso y la ruta HTTP, para no duplicar reglas.

3. **Puerto del repositorio** — [`packages/domain/src/repositories/categoria.repository.ts`](packages/domain/src/repositories/categoria.repository.ts)
   La interfaz `CategoriaRepository` (`listar`, `crear`). El dominio conoce
   esta interfaz, pero no quién la implementa.

4. **Casos de uso** — [`packages/application/src/use-cases/listar-categorias.use-case.ts`](packages/application/src/use-cases/listar-categorias.use-case.ts) y [`crear-categoria.use-case.ts`](packages/application/src/use-cases/crear-categoria.use-case.ts)
   Funciones que reciben sus dependencias por parámetro (`{ categoriaRepository }`)
   — nada de service-locator ni contenedor de DI.

5. **Tabla Drizzle** — [`packages/infrastructure/src/db/schema/categoria.schema.ts`](packages/infrastructure/src/db/schema/categoria.schema.ts)
   Traducción 1:1 de la tabla `categoria` en [`DataBase/dbDiagram.sql`](DataBase/dbDiagram.sql).

6. **Repositorio concreto** — [`packages/infrastructure/src/repositories/categoria.repository.ts`](packages/infrastructure/src/repositories/categoria.repository.ts)
   `DrizzleCategoriaRepository implements CategoriaRepository`: la única
   clase que sabe que existe Drizzle/MySQL.

7. **Rutas HTTP** — [`apps/rest/src/routes/categorias/list.ts`](apps/rest/src/routes/categorias/list.ts) y [`create.ts`](apps/rest/src/routes/categorias/create.ts)
   Un archivo por operación, cada uno exporta un `RouteOptions` de Fastify
   (`listCategoriasRoute`, `createCategoriaRoute`). Arman el repositorio
   concreto con `request.server.db` (ya conectado en el composition root) y
   llaman al caso de uso. [`categorias/index.ts`](apps/rest/src/routes/categorias/index.ts)
   solo los agrupa en `categoriaRoutes: RouteOptions[]` — ver
   [convención de rutas](#convención-de-rutas-http) más abajo.

8. **Composition root** — [`apps/rest/src/server/app.ts`](apps/rest/src/server/app.ts) → [`src/routes/index.ts`](apps/rest/src/routes/index.ts)
   `app.decorate("db", db)` conecta Drizzle una sola vez; `routes/index.ts`
   junta el `RouteOptions[]` de cada módulo (`...categoriaRoutes`) y
   `registerRoutes` los registra con `routes.forEach(route => app.route(route))`.

Regla de dependencia a mantener siempre: `apps/rest → application → domain ← infrastructure`.
`domain` nunca importa nada de `infrastructure` ni de Drizzle/MySQL.

Para probarlo (con el backend corriendo, local o en Docker):

```bash
curl http://localhost:8000/categorias
curl -X POST http://localhost:8000/categorias \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Alimentos","slug":"alimentos"}'
```

Para agregar otra entidad (ej. `producto`), copia este mismo recorrido de 8
pasos cambiando `categoria` por la tabla que corresponda.

## Convención de rutas HTTP

Las rutas de `apps/rest` no se registran con `app.get(...)`/`app.post(...)`
sueltos dentro de una función — se definen como objetos `RouteOptions` de
Fastify, uno por archivo/operación, y se agregan en arreglos que
`routes/index.ts` junta y registra en un loop:

```
apps/rest/src/routes/
  categorias/
    list.ts      // export const listCategoriasRoute: RouteOptions = { method: "GET", url: "/categorias", handler: ... }
    create.ts    // export const createCategoriaRoute: RouteOptions = { method: "POST", url: "/categorias", preHandler: [...], handler: ... }
    index.ts     // export const categoriaRoutes: RouteOptions[] = [listCategoriasRoute, createCategoriaRoute]
  health-check/
    index.ts     // export const healthCheckRoute: RouteOptions = { ... }
  index.ts       // const routes = [healthCheckRoute, ...categoriaRoutes]; registerRoutes = (app) => routes.forEach(r => app.route(r))
```

Para agregar un módulo de rutas nuevo (ej. `productos`): una carpeta
`src/routes/productos/` con un archivo por operación (`list.ts`,
`create.ts`, `update.ts`...), un `index.ts` que exporta `productoRoutes:
RouteOptions[]`, y sumarlo en `src/routes/index.ts` (`...productoRoutes`).
Cada archivo de ruta arma su propio repositorio con `request.server.db` y
llama al caso de uso correspondiente — nunca lógica de negocio directo en
el `handler`.

## Autenticación y autorización en las rutas

La seguridad se resuelve en dos capas, ambas en `apps/rest` (ni `domain` ni
`application` saben que existe un JWT):

1. **¿Estás logueado?** — [`requireAuth`](apps/rest/src/plugins/auth.ts) es
   un `preHandler` de Fastify: verifica el `Bearer <token>` del header
   `Authorization` contra `JWT_SECRET`, y si es válido deja los claims en
   `request.auth` (`{ sub, organizacionId, rol }`). Si falta o es inválido,
   corta con 401 antes de llegar al handler.
2. **¿Tenés permiso?** — [`requireRol(...roles)`](apps/rest/src/plugins/auth.ts)
   es otro `preHandler` que se compone con `requireAuth`: revisa
   `request.auth.rol` contra la lista de roles permitidos para esa ruta. Si
   no calza, corta con 403.

Ejemplo real: [`categorias/list.ts`](apps/rest/src/routes/categorias/list.ts)
queda público (catálogo visible sin login); [`categorias/create.ts`](apps/rest/src/routes/categorias/create.ts)
requiere estar logueado *y* tener rol `administrador`:

```ts
// list.ts — sin preHandler: publica
export const listCategoriasRoute: RouteOptions = {
  method: "GET",
  url: "/categorias",
  handler: async (request) => { /* ... */ }
};

// create.ts — protegida
export const createCategoriaRoute: RouteOptions = {
  method: "POST",
  url: "/categorias",
  preHandler: [requireAuth, requireRol("administrador")],
  handler: async (request, reply) => { /* ... */ }
};
```

Para proteger una ruta nueva, se agrega el mismo array de `preHandler` al
`RouteOptions` — no hace falta tocar nada en `domain`/`application`/`infrastructure`.
`JWT_SECRET` está validado en `apps/rest/src/config/env.ts` (Zod): si falta,
el server no arranca, en vez de fallar recién en el primer request
protegido. Para probarlo con `curl`, hay que mandar un JWT firmado con el
mismo `JWT_SECRET` del `.env`:

```bash
# sin token -> 401
curl -i -X POST http://localhost:8000/categorias -d '{}'

# con token de rol equivocado -> 403
# con token de rol "administrador" -> 201 (crea la categoria)
```

Más adelante, cuando exista el caso de uso de `login` (que arma y firma el
JWT a partir de la tabla `usuario`), `requireRol` se puede volver más
granular leyendo la matriz de permisos JSON de la tabla `rol` del DBML, en
vez de comparar el código de rol a mano.

## Scripts raíz

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm check-types` / `pnpm test` — corren la tarea correspondiente en todo el monorepo vía Turborepo.

## Estructura

```
apps/
  rest/           # backend Fastify (interfaz HTTP)
    src/
      config/       # validación de variables de entorno (Zod)
      lib/          # logger y utilidades propias del backend
      plugins/      # auth (requireAuth/requireRol), rate-limit, etc.
      routes/       # un modulo por dominio de negocio (ver convención de rutas)
      server/       # app.ts (composition root) + index.ts (arranque)
  web/            # Angular — portal de clientes y de distribuidores
  mobile/         # app Flutter — solo distribuidores
packages/
  domain/         # entidades, DTOs, interfaces de repositorio
  application/    # casos de uso
  infrastructure/ # Drizzle + MySQL, implementación de repositorios
  shared-config/  # tsconfig y eslint compartidos
infra/            # docker-compose de producción + Nginx (Digital Ocean)
docs/             # arquitectura y changelog
docker-compose.yml # stack de desarrollo local (mysql + rest + web)
```

## Troubleshooting

- **`docker compose up` falla el servicio `web` por el puerto 4200 ocupado**: probablemente tienes un `ng serve` local corriendo aparte. Ciérralo o usa `docker compose up mysql rest` nada más.
- **El backend no conecta a la base de datos**: revisa `DATABASE_URL` en `apps/rest/.env`. Dentro de Docker Compose, el backend debe apuntar al host `mysql` (nombre del servicio), no a `localhost` — `docker-compose.yml` ya lo sobreescribe automáticamente vía `environment:`.
- **El frontend dice "No se pudo conectar al backend"**: confirma que `apps/web/src/environments/environment.development.ts` (no `.env`) apunte al puerto real del backend, y que `apps/web/angular.json` tenga el `fileReplacements` de `development` → `environment.development.ts` (sin eso, Angular usa siempre `environment.ts`, el de producción).
- **Cambié algo en `packages/domain|application|infrastructure` y el backend no se enteró**: confirma que `pnpm dev` (o `docker compose`) esté usando Turborepo (`turbo run dev`), no `pnpm --filter @cotizapp/rest dev` a secas — solo así se levanta el `tsc -b --watch` de esos paquetes junto con el backend.

## Equipo

| Integrante | Rol |
|---|---|
| Samuel Alarcón Candia | Infraestructura |
| Sebastián Ramírez | DBA · Infraestructura |
| Benjamín González | Frontend · Backend |
