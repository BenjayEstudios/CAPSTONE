# Decisiones cerradas

Cada una con su motivo, para no re-discutirla desde cero más adelante.

## Producto y apps

### Una app web para cliente y proveedor; el admin aparte

`apps/ecommerce` sirve a clientes y proveedores con rutas y guards por rol:
comparten sesión, catálogo y componentes. `apps/admin-site` es otra app
porque sirve al equipo interno y no debe compartir build ni deploy con el
frontend público.

### Una app mobile para los dos perfiles

La épica KAN-87 pide comprador **y** distribuidor en la misma app; navega
según el rol. Antes se pensaba solo para distribuidores (así decían el
scaffold y la arquitectura hasta KAN-125).

### Las apps se nombran por su rol

`backend`, `ecommerce`, `admin-site` en vez de `rest` y `web`: el nombre
dice para quién es la app, no su protocolo.

### Mobile avanza con fakes y un contrato escrito

Mientras un endpoint no existe, la app usa un datasource fake que devuelve
**exactamente** el JSON de `apps/mobile/API_CONTRACT.md`, armado con una
copia del seed. Así mobile no espera al backend, y el backend tiene la forma
exacta a implementar. Pasar a la API real es `USE_FAKES=false`.

### Los roles internos no entran a la app mobile

El login del backend no filtra por rol (sirve también a admin-site); la app
rechaza por su cuenta `admin_general`, `editor_catalogo`, `soporte` y las
cuentas no activas.

## Backend

### Clean Architecture sin contenedor de DI

`apps/backend` → `application` → `domain` ← `infrastructure`. Todo se
conecta explícitamente en el composition root, sin service-locator ni
estado global. El dominio no conoce Drizzle, MySQL ni el JWT, y los casos de
uso se prueban con dobles.

### Auth como `preHandler` por ruta, no hook global

Cada ruta declara lo que exige (`requireAuth`, `requireRol(...)`) en su
propio `RouteOptions`. Lo que protege una ruta se lee en la misma
definición, sin ir a buscar una lista de excepciones aparte, y cada ruta
puede pedir roles distintos. Las públicas (catálogo) quedan explícitas por no
llevar `preHandler`.

### Rutas como `RouteOptions` sueltos

Un archivo por operación, agrupados por módulo y registrados en un loop. Es
la forma que el equipo ya usa en otros proyectos.

### Config validada al arrancar

Todo pasa por Zod en `src/config/env.ts`. Una variable faltante (como pasó
con `JWT_SECRET`) tiene que romper el arranque, no el primer request.

### Puerto 8000 en todos lados

`.env.example`, compose de desarrollo, Dockerfile, compose de producción,
upstream de Nginx y defaults de mobile. El compose de producción lo fija
explícito, así que no depende del default del código.

### CORS como lista

`CORS_ORIGINS` separada por coma, porque hay dos frontends locales (4200 y
4300). Una sola variable; la singular se eliminó.

## Base de datos

### El DBML es la fuente de verdad del modelo

`DataBase/dbDiagram.sql` se mantiene al día y sus notas explican cada
decisión de tabla; el schema de Drizzle lo traduce 1:1.

### Fusiones del modelo

`pago` vive dentro de `orden`; `liquidacion_detalle` dentro de
`orden_envio` (un envío se liquida una sola vez, relación 1:1 real); vistas,
clics y búsquedas son una sola `evento_analitico`. Menos tablas y un solo set
de índices, a cambio de columnas que quedan NULL según el tipo.

### Retiro/despacho garantizado con un CHECK

`ck_orden_envio_destino` en la base, no solo validación en la aplicación: la
regla vale aunque un caso de uso se equivoque o alguien escriba directo en
la base.

### `evento_analitico` particionada y sin FKs

Particionar exige quitar las FKs (InnoDB no las admite en tablas
particionadas). Se acepta porque es telemetría de solo inserción y producto
y oferta nunca se borran; el backend valida las referencias al insertar. A
cambio: pruning por fecha y retención con `DROP PARTITION`.

### Promedio de calificaciones calculado, no guardado

`AVG`/`COUNT` por proveedor en una consulta, no columnas agregadas en
`organizacion`. Con el volumen esperado (cientos o pocos miles por
proveedor) es barato, y evita mantener sincronizado un agregado con triggers
o en cada caso de uso, o corregir promedios descuadrados al moderar. Si
algún día hace falta, se agrega como caché sin cambiar la tabla.

### La calificación cuelga del envío, no de la orden

Cada envío es de un proveedor distinto. Las reglas que cruzan tablas (envío
entregado, usuario de la organización compradora) las garantiza el
`INSERT ... SELECT` del repositorio.

### Nunca `drizzle-kit push`

Hay DDL a mano (FULLTEXT, particiones) que drizzle-kit no conoce y que
`push` borraría. Siempre `generate` + `migrate`.

### El seed no corre contra una base remota sin permiso explícito

Vacía todas las tablas. Contra un host no local exige `--allow-remote`.

## Pagos

### Split simulado en la base propia

La pasarela (sandbox) cobra una sola vez; el reparto entre proveedores se
registra en `liquidacion`, con cortes semanales. No se depende del split
nativo de ninguna pasarela, así el reparto funciona igual sea cual sea la
elegida. Los datos de tarjeta nunca tocan el backend.

### 2FA solo con TOTP y solo para usuarios internos

Lo fija KAN-144. Compradores y proveedores entran con correo y clave.

## Infraestructura

### Un solo droplet con Docker Compose

Nginx + backend + MySQL en contenedores, todo definido en `infra/`. Es lo
proporcional al tráfico de un proyecto de título y cabe en el presupuesto.

### `dev` es producción; todo entra por PR

No hay rama `prod` por costos. Ramas personales → PR a `main` → PR a `dev`.
Nunca push directo a `main` ni a `dev`.

### Frontend horneado en la imagen de Nginx

El `ng build` corre dentro de `infra/nginx/Dockerfile`. Descartado:
buildear en el droplet y montar `dist/` (obliga a tener Node y el repo en el
droplet, `ng build` puede quedarse sin RAM, y frontend y config de Nginx
pueden desfasarse) y bucket + CDN (costo y otra pieza sin beneficio real
para este tráfico). Con la imagen, una versión es un tag y el rollback es
volver al anterior.

### MySQL del compose en producción; Aiven para desarrollo

En producción la base queda en la red interna de Docker, sin exponerse; sin
salto de red a otro proveedor; respaldos bajo nuestro control; costo cero.
El costo es operarla nosotros. Si se quisiera Aiven en producción, basta
cambiar `DATABASE_URL` y no levantar `mysql`.

### Un solo `infra/.env`

Todo lo que cambia entre ambientes, en un archivo. `DATABASE_URL` se arma en
el compose a partir de `MYSQL_PASSWORD` (por eso debe ser alfanumérico).
`apps/backend/.env` no se usa en producción.

### Ningún `.env` entra a una imagen

`Proyecto/.dockerignore` excluye todos los `.env`. Antes la imagen del
backend horneaba credenciales.

### Contenedores de desarrollo con el usuario del host

Para que no dejen archivos de root en el bind mount y rompan builds fuera de
Docker.

### Workflows en la raíz del repo; Flutter solo si cambia mobile

GitHub solo busca `.github/workflows/` en la raíz. El job de Flutter es
caro y casi nunca aplica, así que corre solo si el cambio toca
`apps/mobile`. Solo runners `ubuntu-latest` (repo público, minutos gratis).

### Deploy por SSH con llave dedicada y `known_hosts` fijo

`deploy-dev.yml` usa un usuario `deploy` sin sudo, una llave solo para eso y
el fingerprint del servidor guardado como secret, para no aceptar a ciegas
la llave del host. Queda apagado hasta `DEPLOY_ENABLED=true`.
