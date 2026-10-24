# Changelog

Bitácora de cambios relevantes (features, decisiones de arquitectura,
refactors grandes). Cada entrada: fecha, qué cambió, por qué, y qué carpetas
toca.

## 2026-10-23 — Rediseño visual y pulido de la app mobile para la demo (KAN-125, KAN-126)

Recorrido completo en el emulador (Pixel 8) con `USE_FAKES=true`. Nuevo
diseño: login y splash oscuros (tinta) con logo de Cotizapp, ilustración de
productos con precios comparados, inputs redondeados, botón magenta, ondas
cian/magenta y tarjetas de acceso rápido de demo que ingresan con un toque;
pantallas internas con saludo por organización, placeholders ilustrados,
tarjeta de perfil en Cuenta y barra inferior en magenta. Ícono de la app y
splash nativo de Android con la marca (ícono adaptativo, sin el logo de
Flutter ni destello blanco).

Correcciones: la pestaña "Calificaciones" se partía en dos líneas en la
barra de 5 pestañas (ahora "Reseñas"); el botón Atrás de Android cerraba la
app desde cualquier pestaña (ahora vuelve a la primera); la pantalla de
Conexión mostraba un error rojo genérico sin backend (ahora muestra "Sin
conexión con el backend", aclara que la app sigue con datos de prueba y
distingue cuando en el puerto responde otro servicio). Nueva sección
"Demo" en `apps/mobile/README.md` con los comandos y el recorrido.

**Por qué**: demo de avance de mobile corriendo en el emulador.

**Toca**: `apps/mobile/lib/core/theme/app_theme.dart`,
`lib/core/widgets/{marca,pantalla_pendiente}.dart`,
`lib/core/router/{app_router,perfil_shell}.dart`,
`lib/features/auth/presentation/*`, `lib/features/conexion/*`,
`android/app/src/main/res/*` (íconos, splash, colores), `test/`,
`README.md`.

## 2026-10-23 — Login y navegación según perfil en mobile (KAN-126)

Nueva feature `auth` en `apps/mobile`: pantalla de login (validación,
errores del backend, atajos a usuarios del seed en modo fake), sesión
guardada en el almacenamiento seguro del dispositivo (Keystore/Keychain)
y restaurada al abrir la app, y logout desde la pestaña Cuenta. El router
redirige según el rol: `comprador` → Inicio / Carro / Pedidos / Cuenta;
`proveedor` → Resumen / Órdenes / Calificaciones / Alertas / Cuenta
(pestañas de tickets futuros como placeholder), y cada perfil no puede
entrar a las rutas del otro. Los roles internos y las cuentas no activas
(Las Palmas) se rechazan. Un 401 a un request con token cierra la sesión.

**Por qué**: el epic KAN-87 pide una sola app para comprador y
distribuidor. `POST /auth/login` aún no existe en el backend: la app usa
un fake con los usuarios del seed (`USE_FAKES=true`) y el contrato quedó
en `apps/mobile/API_CONTRACT.md`.

**Ojo (backend)**: `POST /categorias` exige `requireRol("administrador")`
pero el código del rol en el seed es `admin_general`.

**Toca**: `apps/mobile/lib/features/auth/` (nuevo), `lib/core/router/*`,
`lib/core/network/` (token + expiración, `parseo.dart`),
`lib/core/fake/seed.dart`, `lib/core/widgets/pantalla_pendiente.dart`,
`test/`, `dart_test.yaml`, `pubspec.yaml`/`pubspec.lock`
(`flutter_secure_storage`), `API_CONTRACT.md`, `README.md`,
`lib/features/README.md`.

## 2026-10-23 — Infra: CI de tests, stack de producción servible y compose de dev sin root (KAN-161, KAN-158)

**CI (KAN-161, primera parte)**: `.github/workflows/ci.yml` en la raíz del
repo. En cada PR a `main`/`dev` y push a `dev-*`: job Node (pnpm de
`packageManager`, Node 22, `turbo run check-types lint build`, vitest y
`ng test` en ChromeHeadless) y job Flutter (`pub get`, `analyze`, `test`)
solo si cambia `apps/mobile`. `deploy-dev.yml` queda listo pero apagado
hasta crear la variable `DEPLOY_ENABLED=true` (secrets en
`infra/README.md`). **Hoy el job Node falla** en `lint` y `test` de
ecommerce y admin-site: no tienen target de lint ni karma/specs.

**Producción (KAN-158)**: nueva imagen `infra/nginx/Dockerfile` que compila
`apps/ecommerce` y lo sirve como SPA (fallback a `index.html`, caché
inmutable para assets con hash) con `/api/` proxeado al backend. Config de
Nginx como plantilla (`infra/nginx/templates`, `snippets`). Se reemplazó
`infra/nginx/nginx.conf`. Puerto del backend unificado en **8000**.
Producción usa el **MySQL del compose** (Aiven queda como base de dev); toda
la config productiva va en un solo `infra/.env`.

**Dockerfile del backend**: no construía (node:20 con pnpm 11, que exige
Node ≥ 22.13) y horneaba `apps/backend/.env` con credenciales en la imagen
(no había `.dockerignore`). Ahora es multi-stage, con Node 22, solo
dependencias de producción, usuario `node` y 345 MB en vez de 923 MB.

**Compose de desarrollo**: los contenedores corren con el usuario del host
(`DEV_UID`/`DEV_GID`, default 1000) para que no dejen archivos de root en
`packages/*/dist`, `.angular`, `.turbo` ni `.pnpm-store`.

**Por qué**: tener CI desde ya en los PRs, y dejar el droplet desplegable
con frontend + API + BD sin pasos manuales en el build.

**Toca**: `.github/workflows/{ci,deploy-dev}.yml` (nuevo),
`Proyecto/.dockerignore` (nuevo), `apps/backend/Dockerfile`,
`docker-compose.yml`, `infra/docker-compose.prod.yml`, `infra/.env.example`,
`infra/README.md`, `infra/nginx/*` (nuevo; borra `nginx.conf`).

## 2026-10-23 — Estructura base de la app mobile (KAN-125)

`apps/mobile` pasa de esqueleto a base lista para las features: carpeta
`android/` generada (`cl.cotizapp.cotizapp_mobile`, label "Cotizapp",
permiso INTERNET), `AppConfig` con `API_URL` y `USE_FAKES` por
`--dart-define` (default `10.0.2.2:8000` en Android, `localhost:8000` en el
resto), `ApiClient` con interceptor de token y traducción del formato de
error del backend (`{error:{code,message}}`) a `Failure` tipados, tema con
la paleta del mockup móvil, formatos es-CL (CLP, plazos, fechas), vistas de
carga/error/vacío y la feature de referencia `conexion` (pantalla de
diagnóstico contra `GET /health-check`). Nuevo `API_CONTRACT.md` con las
convenciones y los endpoints que la app necesita del backend. Primeros
tests (`flutter test`, 14 casos).

**Por qué**: Jira (epic KAN-87) amplió la app a comprador **y**
distribuidor; se corrigieron `pubspec.yaml`, `README.md` y
`lib/features/README.md`, que decían "solo distribuidores". Los fakes con
datos del seed permiten avanzar las pantallas sin esperar los endpoints.

**Ojo**: el esqueleto usaba comillas dobles y `analysis_options.yaml` exige
`prefer_single_quotes` (12 avisos en `flutter analyze`); se pasó todo a
comillas simples.

**Toca**: `apps/mobile/` (`android/`, `lib/core/*`, `lib/features/conexion/`,
`test/`, `pubspec.yaml` + `pubspec.lock` — deps `intl`,
`flutter_localizations` —, `analysis_options.yaml`, `.gitignore`,
`.metadata`, `.env.example`, `README.md`, `API_CONTRACT.md`).

## 2026-10-23 — Datos semilla y de prueba (KAN-141)

Nuevo comando `pnpm --filter @cotizapp/infrastructure db:seed`: vacía las
21 tablas y carga un escenario coherente — 4 proveedores con ofertas a
precios distintos por producto (comparador), 2 clientes, usuarios de todos
los roles, 2 órdenes multiproveedor con envíos, líneas, liquidación y DTE,
y datos de cobertura, analítica, auditoría y moderación. IDs fijos y
claves hasheadas con bcrypt; usuarios y clave de prueba documentados en
`packages/infrastructure/README.md`.

**Por qué**: para que backend, ecommerce, admin-site y mobile trabajen
contra datos reales en vez de mocks, y para tener la demo armada.

**Ojo**: si `DATABASE_URL` apunta a un host no local (Aiven) el script
se niega a correr salvo con `--allow-remote`, porque borra todo.

**Toca**: `packages/infrastructure/src/db/seed/*` (nuevo),
`packages/infrastructure/package.json` (script `db:seed`, deps `bcryptjs`,
`tsx`, `@types/node`), `packages/infrastructure/README.md`,
`pnpm-lock.yaml`.

## 2026-10-22 — Traducción completa del modelo DBML a Drizzle + CORS multi-frontend

Se tradujeron las 20 tablas restantes de `DataBase/dbDiagram.sql` (DBML) a
schema de Drizzle (`packages/infrastructure/src/db/schema/<tabla>.schema.ts`),
siguiendo el mismo patrón que `categoria`. Se generó y aplicó la migración
`0001_tense_next_avengers.sql` contra el MySQL local — las 21 tablas (20
nuevas + `categoria`) ya existen en la base de datos, con todas sus FKs e
indices, incluida la referencia circular `usuario` ↔ `rol`.

Tambien se corrigió CORS en `apps/backend`: `CORS_ORIGIN` (singular, el
que realmente leía `@fastify/cors`) solo permitía `localhost:4200`, pero
`admin-site` corre en `:4300` — causaba `CORS policy` bloqueando requests
desde ahí. `env.ts` ahora parsea `CORS_ORIGINS` (plural, lista separada por
coma) como arreglo y es la única variable que se usa; se eliminó la
`CORS_ORIGIN` singular duplicada de los `.env`.

**Por qué**: con el modelo completo en Drizzle, cualquiera del equipo puede
empezar a escribir repositorios/casos de uso contra tablas reales en vez de
mockear datos. El fix de CORS desbloqueaba a quien estuviera probando
`admin-site` contra el backend local.

**Toca**: `packages/infrastructure/src/db/schema/*.ts` (20 archivos
nuevos + `index.ts`), `packages/infrastructure/migrations/0001_*.sql`,
`apps/backend/src/config/env.ts`, `apps/backend/src/server/app.ts`,
`apps/backend/.env`, `apps/backend/.env.example`, `docs/ARCHITECTURE.md`.

## 2026-10-13 — Rename de apps: rest→backend, web→ecommerce, + admin-site

Se renombró `apps/rest` a `apps/backend` y `apps/web` a `apps/ecommerce` para
que el nombre de carpeta describa el rol de cada app en vez de su protocolo
(REST) o su naturaleza técnica (web), y para dejar espacio al nuevo nombre
`apps/admin-site`. Se agregó `apps/admin-site` (Angular, scaffold mínimo,
misma convención que `apps/ecommerce`) como la futura interfaz de
administración del sitio (gestión de usuarios, moderación, catálogo global —
aún sin implementar).

**Toca**: nombres de paquete (`@cotizapp/backend`, `@cotizapp/ecommerce`),
`pnpm-workspace.yaml`, `docker-compose.yml` (servicios, contenedores,
volúmenes), `infra/docker-compose.prod.yml`, `infra/nginx/nginx.conf`,
`apps/backend/Dockerfile`, `apps/ecommerce/angular.json` (nombre de proyecto,
`outputPath`, build targets), `.gitignore`, `README.md`,
`docs/ARCHITECTURE.md`, comentarios de referencia cruzada en
`packages/application`, `packages/domain`, `packages/shared-config`,
`apps/mobile`. Las entradas anteriores de este changelog mencionan `apps/rest`
y `apps/web` porque describen el estado del repo en ese momento — se dejan
sin editar.

## 2026-09-22 — Auth por rutas (preHandler) + rutas como RouteOptions

Se agregó `apps/rest/src/plugins/auth.ts` (`requireAuth`/`requireRol`, como
`preHandler` de Fastify) y se protegió `POST /categorias` con
`requireRol("administrador")` a modo de ejemplo. Se reestructuraron las
rutas de `apps/rest` para que cada operación exporte un objeto `RouteOptions`
suelto (`list.ts`, `create.ts`), agrupado en un arreglo por módulo
(`categoriaRoutes: RouteOptions[]`) y registrado con un loop en
`routes/index.ts`, siguiendo el mismo patrón estructural de rutas del
proyecto CMV (no los nombres, la forma de organizar/registrar). Se agregó
`JWT_SECRET` al schema de Zod de `apps/rest/src/config/env.ts` — antes se
leía directo de `process.env` sin validar, y el server arrancaba igual si
faltaba, fallando recién en el primer request protegido.

**Por qué**: dejar un patrón de referencia de autenticación/autorización por
rutas (dos capas: `requireAuth` = ¿estás logueado?, `requireRol` = ¿tenés
permiso?), consistente con cómo se organizan las rutas en otros proyectos
del equipo, y que la configuración faltante falle rápido al arrancar en vez
de a mitad de un request.

**Toca**: `apps/rest/src/plugins/auth.ts`, `apps/rest/src/routes/**`,
`apps/rest/src/config/env.ts`, `apps/rest/package.json` (dependencia
`jsonwebtoken`), `README.md`, `docs/ARCHITECTURE.md`.

## 2026-09-22 — Entorno de desarrollo con Docker Compose + ejemplo end-to-end

Se agregó `docker-compose.yml` en la raíz para levantar MySQL + backend +
frontend con un solo comando (`docker compose up`), con hot-reload real
(bind mount + `tsx watch`/`ng serve`, y `turbo run dev` con `envMode: loose`
para que el watch de `packages/domain|application|infrastructure` también
reinicie `apps/rest`). Se agregó un logger propio en `apps/rest/src/lib/logger.ts`
para logs estructurados en consola, un endpoint `GET /health-check`, y una
vista de status en `apps/web` (`/`) que lo consume para verificar que todo
levantó bien. Se agregaron `.env.dev`/`.env.prod` de referencia en
`apps/rest`.

Se implementó el primer caso de uso end-to-end (`categoria`: listar/crear)
como ejemplo de referencia de Clean Architecture — ver
`docs/ARCHITECTURE.md#ejemplo-de-referencia-categoria` y el README raíz.

**Por qué**: para que el resto del equipo pueda clonar el repo y ponerse a
desarrollar (frontend o backend) sin tener que resolver a mano el setup de
Node/pnpm/MySQL, y para que quede un ejemplo concreto de cómo se conectan
`domain`/`application`/`infrastructure`/`apps/rest` al agregar una feature
nueva.

**Toca**: `docker-compose.yml`, `turbo.json`, `apps/rest/package.json`,
`packages/{domain,application,infrastructure}/package.json`,
`apps/rest/src/{lib/logger.ts,server,routes}`, `apps/web/src/{app,environments}`,
`apps/web/angular.json`, `README.md`, `docs/ARCHITECTURE.md`.

## 2026-09-14 — Scaffold base del monorepo

Se creó la estructura base del monorepo (pnpm + Turborepo) con Clean
Architecture, siguiendo la plantilla `Estructura-projects`: `packages/domain`,
`packages/application`, `packages/infrastructure` (MySQL vía Drizzle),
`packages/shared-config`, y las apps `apps/rest` (Fastify), `apps/web`
(Angular — clientes y distribuidores) y `apps/mobile` (Flutter/Riverpod —
solo distribuidores).

**Por qué**: punto de partida del proyecto de título Cotizapp (Fase 1 —
Capstone), con inyección de dependencias explícita (sin service-locator) y
sin acoplar el dominio a Drizzle/MySQL.

**Toca**: todo el repo (commit inicial). Sin lógica de negocio ni vistas
todavía — el schema de `packages/infrastructure/src/db/schema` aún no
traduce el modelo de `DataBase/dbDiagram.sql`, y no hay rutas ni módulos
(`auth`, `catalogo`, `pedidos`, `pagos`) implementados en `apps/rest`.
