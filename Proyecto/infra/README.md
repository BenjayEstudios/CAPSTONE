# infra

Despliegue de producción de Cotizapp en **un único droplet de Digital Ocean**,
todo containerizado con Docker Compose. Todo lo que corre en el droplet está
definido como código en esta carpeta.

> El `docker-compose.yml` de `Proyecto/` es solo para **desarrollo** (hot
> reload con bind mounts). Producción es `infra/docker-compose.prod.yml`.

## Arquitectura

```
                 Internet
                    │ :80
           ┌────────▼─────────┐
           │      nginx       │  imagen cotizapp-nginx (infra/nginx/Dockerfile)
           │ APP_DOMAIN   → ecommerce   (SPA)
           │ ADMIN_DOMAIN → admin-site  (SPA)
           │  /uploads/* → volumen (solo lectura)
           │  /api/* → proxy ─┼──┐  (en los dos dominios)
           └──────────────────┘  │ red interna de Docker
                        ┌────────▼─────────┐
                        │     backend      │  imagen cotizapp-backend
                        │ Fastify :8000    │  (apps/backend/Dockerfile)
                        │ /data/uploads ◄──┼── volumen cotizapp-uploads
                        └────────┬─────────┘     (también montado en nginx)
                        ┌────────▼─────────┐
                        │      mysql       │  mysql:8.4, volumen
                        │ :3306 (interno)  │  cotizapp-mysql-data
                        └──────────────────┘
```

Solo nginx publica puertos. MySQL y el backend no son accesibles desde
internet.

## Archivos

| Archivo | Qué es |
|---|---|
| `docker-compose.prod.yml` | Stack de producción: `nginx`, `backend`, `mysql` y `certbot` (renueva el certificado HTTPS). Las imágenes son `ghcr.io/benjayestudios/cotizapp-{nginx,backend}:${IMAGE_TAG}`; conserva `build:` para construirlas en local. |
| `deploy/desplegar.sh` | Deploy en el droplet: pull de GHCR → migraciones → `up` sin build → health-check. Lo llama `deploy-dev.yml`; sirve a mano y en local. |
| `deploy/certificado.sh` | Emite el certificado de Let's Encrypt (una vez, en el droplet; `--prueba` ensaya contra el staging). Ver [deploy/README.md](deploy/README.md#activar-https-kan-159). |
| `deploy/cloud-init.yml` | Prepara un droplet nuevo en su primer arranque. Guía para crearlo y costos: [deploy/README.md](deploy/README.md). |
| `oracle/` | QA adicional en Oracle Cloud Always Free (VM ARM, US$0): cloud-init y guía. Lo despliega `deploy-oracle.yml` con imágenes `-arm64`. Ver [oracle/README.md](oracle/README.md). |
| `.env.example` | Variables de producción (dominio, passwords, JWT). Se copia a `infra/.env` en el droplet. |
| `nginx/Dockerfile` | Compila `apps/ecommerce` y `apps/admin-site` (Angular) y los copia en una imagen `nginx:1.30-alpine`. |
| `nginx/templates/http/default.conf.template` | Config en modo HTTP: un `server` en el 80 por dominio (ecommerce por defecto, admin-site en `ADMIN_DOMAIN`). La imagen oficial le aplica `envsubst` al arrancar. |
| `nginx/templates/https/default.conf.template` | Config en modo HTTPS (KAN-159): el 80 solo atiende Let's Encrypt y redirige con 301; los dos sitios en 443 con HTTP/2. |
| `nginx/snippets/comun.conf` | Común a las dos plantillas: gzip, `server_tokens off`, resolver de Docker y `upstream` del backend. |
| `nginx/snippets/sitio-ecommerce.conf`, `sitio-admin.conf` | Contenido de cada sitio (root, API, uploads, SPA, `robots.txt` del admin), igual en HTTP y HTTPS. |
| `nginx/snippets/acme.conf`, `tls.conf` | Desafío HTTP-01 de Let's Encrypt (`/.well-known/acme-challenge/`) y parámetros TLS (solo 1.2 y 1.3). |
| `nginx/entrypoint/18-esquema.envsh` | Elige la plantilla según `PUBLIC_SCHEME`; con `https` sin certificado se queda en HTTP y lo avisa. |
| `nginx/entrypoint/40-recargar-certificados.sh` | En HTTPS, `nginx -s reload` cada 12 h para tomar el certificado renovado. |
| `nginx/snippets/api-proxy.conf` | `location /api/` → backend (quita el prefijo `/api`). |
| `nginx/snippets/spa.conf` | Reglas de SPA: fallback a `index.html` y caché de assets con hash. |
| `nginx/snippets/uploads.conf` | `/uploads/` → archivos subidos, directo del volumen. Solo `productos/<id>/<uuid>.jpg\|png` es público. |
| `nginx/entrypoint/19-limite-subidas.envsh` | Calcula el tope del body de Nginx (`UPLOADS_MAX_MB + 1` MB) antes de aplicar la plantilla. |
| `../apps/backend/Dockerfile` | Imagen del backend (multi-stage, solo deps de producción, usuario `node`, archivos subidos en `/data/uploads`). Incluye `packages/infrastructure/migrations/` para el paso de migraciones. |
| `../.dockerignore` | Excluye `node_modules`, `dist`, `*.tsbuildinfo` y **todos los `.env`** del contexto de build. |

## Decisiones

### Frontends horneados en la imagen de Nginx (KAN-158)

El build de Angular se hace **dentro** de `nginx/Dockerfile` (stage de Node)
y el resultado (`dist/ecommerce/browser`) se copia a la imagen de Nginx.
Alternativas descartadas:

- *Buildear en el droplet y montar `dist/` como volumen*: obliga a tener
  Node + el repo en el droplet, y `ng build` puede quedarse sin RAM en un
  droplet chico. El deploy deja de ser atómico (frontend y config de Nginx
  pueden quedar desfasados).
- *Bucket + CDN (DO Spaces)*: costo extra y otra pieza que mantener, sin
  beneficio real para el tráfico de un proyecto de título.

Con la imagen, una versión = un tag que incluye frontend + config de Nginx,
el rollback es volver al tag anterior y el CI (KAN-161) puede construirla
fuera del droplet.

En producción los frontends usan `apiUrl: "/api"` (ver
`apps/ecommerce/src/environments/environment.ts`): mismo origen, sin CORS.

Caché: los archivos con hash (`main-XXXXXXXX.js`, `styles-…css`) se sirven
con `Cache-Control: immutable` por un año; `index.html` y el fallback de la
SPA con `no-cache`, así un deploy se ve de inmediato. Un asset con hash que
no existe responde 404 (no `index.html`).

### admin-site en su propio subdominio (KAN-168)

`apps/admin-site` se sirve en `ADMIN_DOMAIN` (ej. `admin.cotizapp.cl`), con
su propio `server` en Nginx y el mismo `/api/` proxeado al backend. Se
descartó `/admin/` bajo el dominio del ecommerce porque:

- **Aísla la sesión**: el panel guarda su JWT en `localStorage`, que es por
  origen. En otro origen, un XSS en el ecommerce (público, más superficie)
  no puede leer el token de un administrador.
- **Sin cambios en la app**: cada SPA vive en la raíz de su dominio, así que
  no hace falta `--base-href /admin/` ni tocar `<base href>` ni rutas.
- **Restringible por separado** si algún día se quiere (allowlist de IPs o
  basic auth en ese `server`), sin afectar al ecommerce.

Costo: un registro DNS más y un certificado que cubra los dos nombres
(KAN-159). Sin dominio propio sirve nip.io (ver `.env.example`).

El acceso real no depende de Nginx: los estáticos del panel son solo la
pantalla de login; los datos los protege el backend (`requireAuth` +
permisos por rol, 2FA para internos). El panel responde un `robots.txt` que
bloquea a los buscadores.

### Archivos subidos: volumen del droplet, servidos por Nginx (KAN-157)

Las imágenes de producto se guardan en el volumen `cotizapp-uploads`. El
backend escribe ahí (`UPLOADS_DIR=/data/uploads`) y Nginx monta el mismo
volumen **de solo lectura** y lo sirve en `/uploads/`, sin pasar por Node.

| | Volumen local (elegido) | DO Spaces |
|---|---|---|
| Costo | Incluido en el droplet | US$5/mes fijos |
| Código | `AlmacenLocal` ya existe | Hay que escribir `AlmacenSpaces` en el backend |
| Respaldo | Junto con la base (KAN-160) | Propio del servicio |
| CDN / escala | No | Sí |
| Si se pierde el droplet | Se recupera del respaldo | Sigue ahí |

Para el tráfico de un proyecto de título, el volumen alcanza. Cambiar después
es otro adaptador detrás del puerto `AlmacenArchivos` más reescribir las URL
guardadas.

Reglas de Nginx (`snippets/uploads.conf`):

- Solo `/uploads/productos/<id>/<uuid>.jpg|png` es público, con
  `Cache-Control: immutable` (el nombre es un UUID que nunca se reescribe),
  `nosniff` y `Content-Security-Policy: sandbox`. Todo lo demás, 404.
- `/api/uploads/` da 404: el static del backend no tiene auth.
- Los **documentos de proveedor** (KAN-150) no deben ir por `/uploads/`: van
  por un endpoint con auth.

Límite de tamaño con **una sola variable**, `UPLOADS_MAX_MB` (default 5): el
backend rechaza con 413, y Nginx corta el body en `UPLOADS_MAX_MB + 1` MB
(holgura para el multipart) respondiendo el mismo JSON de error.

**Ojo**: `producto.imagenes` guarda la URL absoluta
(`PUBLIC_BASE_URL=<PUBLIC_SCHEME>://APP_DOMAIN`). Un cambio de dominio o el
paso a `https` (KAN-159) rompe las URL ya guardadas. Al activar HTTPS en QA
(2026-11-21) ningún producto tenía imágenes, así que no se rompió nada.

### Base de datos de producción: MySQL del compose, no Aiven

Producción usa el **MySQL 8.4 del propio compose**, en el mismo droplet. La
MySQL de Aiven queda como base **compartida de desarrollo** del equipo (es la
que apunta `apps/backend/.env`).

Por qué:

- **Red privada**: la base no queda expuesta a internet; el backend la
  alcanza por la red interna de Docker. Aiven exige exponerla (con TLS y
  allowlist de IPs).
- **Latencia y disponibilidad**: sin salto de red a otro proveedor/región, y
  sin depender de los límites del plan gratuito de Aiven.
- **Respaldos bajo nuestro control** (KAN-160): `mysqldump` programado +
  copia fuera del droplet, con restauración que podemos probar end-to-end.
- **Costo cero** adicional.

Costo de esta decisión: la operación (backups, upgrades) es nuestra. Si en
algún momento se quisiera usar Aiven en producción, basta con cambiar
`DATABASE_URL` del servicio `backend` (agregando `?ssl={"rejectUnauthorized":true}`)
y dejar de levantar `mysql`; en ese caso los respaldos serían los
automáticos de Aiven más un dump propio.

### Puerto del backend: 8000

El backend escucha en **8000** en todos lados: `apps/backend/.env.example`,
el compose de desarrollo, el Dockerfile (`ENV PORT=8000`), el compose de
producción y el `upstream` de Nginx. El compose de producción fija `PORT`
explícitamente, así que no depende del default del código.

### Variables de entorno de producción

Un solo archivo, `infra/.env` (plantilla: `.env.example`), con todo lo que
cambia entre ambientes. El compose le pasa a cada servicio solo lo que
necesita. `DATABASE_URL` se arma en el compose a partir de `MYSQL_PASSWORD`,
así que el password no se repite en dos lugares (por eso debe ser
alfanumérico). `apps/backend/.env` **no** se usa en producción.

## Primer despliegue en el droplet

El droplet se crea con [`deploy/cloud-init.yml`](deploy/cloud-init.yml), que
lo deja listo (Docker, usuario `deploy`, clon en `/opt/cotizapp`,
`infra/.env` con secretos generados ahí y dominios nip.io). Paso a paso y
costos: [deploy/README.md](deploy/README.md). El droplet **no compila**: baja
las imágenes que construyó el CI en GHCR.

Sin cloud-init, a mano como root (ver el script dentro de `cloud-init.yml`):

```bash
git clone https://github.com/BenjayEstudios/CAPSTONE.git /opt/cotizapp
cd /opt/cotizapp/Proyecto/infra
cp .env.example .env
# editar .env: APP_DOMAIN, ADMIN_DOMAIN, y generar cada secreto con `openssl rand -hex 32`
chmod 600 .env
docker compose -f docker-compose.prod.yml config --quiet
```

El deploy en sí lo hace el workflow `deploy-dev.yml` (push a `dev` o
   *Run workflow*) una vez creada la variable `DEPLOY_ENABLED=true`: baja las
   imágenes del commit, corre las migraciones sobre la base vacía y levanta el
   stack. Si las imágenes de GHCR son públicas, también se puede a mano:
   `IMAGE_TAG=dev ./deploy/desplegar.sh`.

```bash
# Verificar
docker compose -f docker-compose.prod.yml ps        # los 3 servicios "healthy"/"Up"
curl -s http://localhost/api/health-check           # {"status":"ok",...}
curl -s -H "Host: $ADMIN_DOMAIN" http://localhost/ | grep '<title>'   # Cotizapp Admin
```

DNS: dos registros `A` hacia la IP del droplet, uno para `APP_DOMAIN` y otro
para `ADMIN_DOMAIN` (o un comodín `*.dominio`).

## Operación

```bash
cd /opt/cotizapp/Proyecto/infra
docker compose -f docker-compose.prod.yml logs -f backend      # logs
docker compose -f docker-compose.prod.yml up -d --no-build     # reiniciar con las imágenes que ya están
docker compose -f docker-compose.prod.yml exec nginx nginx -t  # validar config de Nginx
docker compose -f docker-compose.prod.yml exec mysql \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" cotizapp'       # consola MySQL
docker compose -f docker-compose.prod.yml run --rm --no-deps backend \
  node packages/infrastructure/dist/db/migrar/run.js           # migraciones a mano
```

Sin `IMAGE_TAG`, el compose usa el tag `dev` (último build de `dev`). Tras un
rollback, los comandos a mano deben llevar `IMAGE_TAG=<sha>` para no volver a
la última versión sin querer.

## CI/CD (GitHub Actions)

Los workflows viven en la **raíz del repo** (`.github/workflows/`, no en
`Proyecto/`) porque GitHub solo los busca ahí; corren con
`working-directory: Proyecto`. Solo runners `ubuntu-latest` (repo público:
minutos gratis).

### `ci.yml` — tests en cada PR

Se dispara en `pull_request` hacia `main` y `dev`, y en `push` a `dev-*`.
Un push nuevo cancela la corrida anterior de la misma rama/PR.

| Job | Qué corre |
|---|---|
| **Node** | pnpm (versión de `packageManager`), Node 22, caché de pnpm y de Turborepo. `pnpm install --frozen-lockfile` → `turbo run check-types lint test build` (vitest en backend/packages; angular-eslint y karma en ChromeHeadless en ecommerce y admin-site). |
| **Flutter** | Solo si el PR/push toca `Proyecto/apps/mobile/**` (o el propio `ci.yml`). Flutter 3.47.5 stable: `flutter pub get`, `flutter analyze`, `flutter test`. Si no corre aparece como *skipped*, que GitHub cuenta como éxito. |

El script `test` de las apps Angular es `ng test --watch=false
--browsers=ChromeHeadless`: corre igual en local y en el runner (necesita
Chrome o Chromium instalado; si no está en el PATH, exportar `CHROME_BIN`).

Reproducir en local lo mismo que el job Node (desde `Proyecto/`):

```bash
CI=true pnpm install --frozen-lockfile
pnpm exec turbo run check-types lint test build --continue
```

Validar la sintaxis de los workflows (desde la raíz del repo):

```bash
docker run --rm -v "$PWD:/repo:ro" --workdir /repo rhysd/actionlint:1.7.12
```

**Recomendado (manual, en GitHub)**: Settings → Branches → reglas para
`main` y `dev` que exijan el check *Node (check-types, lint, test, build)*
antes de mergear.

### `deploy-oracle.yml` — QA en Oracle Cloud (ARM)

Mismo esquema que `deploy-dev.yml`, independiente de él: construye las
imágenes en un runner ARM (`<sha>-arm64`, `dev-arm64`) y las despliega en la
VM de Oracle con el mismo `desplegar.sh`. Apagado hasta `ORACLE_ENABLED=true`.
Detalle, secrets y riesgos del plan gratuito: [oracle/README.md](oracle/README.md).

### `deploy-dev.yml` — imágenes en GHCR y deploy al droplet

```
push a dev ──► build (matriz: backend, nginx) ──► GHCR ──► deploy (si DEPLOY_ENABLED=true)
               docker buildx, caché type=gha       │        SSH al droplet:
               tags :<sha> y :dev                  │        git checkout <sha>
                                                   └──────► desplegar.sh
                                                              pull → migraciones → up --no-build
                                                              → /api/health-check
```

**Job `build`** (corre siempre en push a `dev`, aunque el deploy esté
apagado; también con *Run workflow* desde `dev`). Construye las dos imágenes
con los mismos Dockerfiles que en local y las publica en
`ghcr.io/benjayestudios/cotizapp-backend` y `cotizapp-nginx` con dos tags: el
SHA completo del commit y `dev`. Usa `GITHUB_TOKEN` con
`permissions: packages: write` solo en ese job. La label
`org.opencontainers.image.source` enlaza los paquetes al repo (heredan sus
permisos). La caché de capas va en GitHub Actions (`type=gha`).

**Job `deploy`** (`needs: build`, apagado hasta `DEPLOY_ENABLED=true`), con
`permissions: packages: read`. Entra por SSH, deja el clon en el commit del
tag (así el compose y el script coinciden con las imágenes) y corre
[`deploy/desplegar.sh`](deploy/desplegar.sh):

1. `docker login ghcr.io` con el `GITHUB_TOKEN` del job. El token viaja por
   la entrada estándar del SSH y llega a `docker login --password-stdin`:
   nunca aparece como argumento ni en el `ps` del droplet.
2. `docker compose pull`.
3. **Migraciones**: `docker compose run --rm backend node
   packages/infrastructure/dist/db/migrar/run.js`, contenedor de una sola
   vez con la imagen nueva. Si falla, el deploy se detiene y sigue corriendo
   la versión anterior. Ver
   [packages/infrastructure/README.md](../packages/infrastructure/README.md#migraciones-en-el-deploy).
4. `docker compose up -d --no-build --remove-orphans --wait`: el droplet no
   compila nunca; si falta una imagen, falla.
5. Health-check en `/api/health-check`.
6. `docker logout ghcr.io` (siempre, aunque algo falle) y `docker image prune -f`.

**Rollback**: *Actions → Deploy dev → Run workflow* (rama `dev`) con `tag` =
SHA completo de un deploy anterior. No construye nada, redespliega esas
imágenes con el compose de ese commit y **no corre migraciones** (son solo
hacia adelante: el código viejo tiene que tolerar el esquema nuevo). Solo se
puede volver a commits que ya tengan `desplegar.sh` (desde KAN-161).

Configuración en GitHub. `BenjayEstudios/CAPSTONE` es un repo de **cuenta
personal** (no de organización): solo el dueño (BenjayEstudios) puede crear
secrets, variables y environments; los colaboradores tienen permiso de
escritura y no se les puede dar rol de admin. Secrets en Settings →
Environments → `dev` (el workflow ya lo declara); `DEPLOY_ENABLED` como
variable **del repositorio** (Settings → Secrets and variables → Actions →
Variables), porque el `if` del job se evalúa antes de entrar al environment:

| Nombre | Tipo | Valor |
|---|---|---|
| `DEPLOY_HOST` | secret | IP o dominio del droplet. |
| `DEPLOY_USER` | secret | Usuario de deploy en el droplet (ej. `deploy`, en el grupo `docker`, sin sudo). |
| `DEPLOY_SSH_KEY` | secret | Llave privada **dedicada** al deploy (ed25519, sin passphrase). |
| `DEPLOY_KNOWN_HOSTS` | secret | Salida de `ssh-keyscan -t ed25519 <ip>`; comparar su fingerprint con el que muestra `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` dentro del droplet ([cómo](deploy/README.md#crear-el-droplet)). Evita aceptar a ciegas la llave del servidor. |
| `DEPLOY_PATH` | variable (opcional) | Ruta del clon en el droplet. Default `/opt/cotizapp`. |
| `DEPLOY_ENABLED` | variable | `true` para activar el deploy. |

GHCR no necesita secrets: usa el `GITHUB_TOKEN` automático y publica los
paquetes en la cuenta de BenjayEstudios. Puede hacer falta (lo hace él):

- Si el primer `build` falla con `denied` al publicar: revisar que no exista
  ya un paquete con ese nombre sin acceso para el repo (*Package settings →
  Manage Actions access* → agregar `CAPSTONE` con rol *Write*).
- Una vez publicados, en cada paquete (`cotizapp-backend`, `cotizapp-nginx`)
  → *Package settings*: confirmar que el repo `CAPSTONE` tiene acceso (lo da
  la label source) y, opcional, hacerlos **públicos** (el repo ya lo es) para
  poder hacer `pull` a mano en el droplet sin token.

Preparación del droplet (usuario `deploy`, llave dedicada, fingerprint para
`DEPLOY_KNOWN_HOSTS`): [deploy/README.md](deploy/README.md#crear-el-droplet).

**¿Hace falta el clon en el droplet?** Para correr, no: el compose funciona
solo, con `.env` y las imágenes (probado). Se mantiene porque `git checkout
<sha>` deja el compose y `desplegar.sh` exactamente de esa versión, lo que
hace trivial el rollback. La alternativa (copiar por `scp` solo
`docker-compose.prod.yml` y `deploy/` desde el runner) evita tener git y el
repo en el droplet; queda como mejora si se quiere un droplet más limpio.

## Probar el stack de producción en local

Sin tocar `infra/.env`, con un env de prueba, otro puerto y el mismo script
del deploy (sin `pull`: las imágenes se construyen en local):

```bash
cd Proyecto/infra
printf '%s\n' APP_DOMAIN=localhost ADMIN_DOMAIN=admin.localhost HTTP_PORT=8088 \
  MYSQL_PASSWORD=testpass123 MYSQL_ROOT_PASSWORD=testroot123 JWT_SECRET=testjwt > /tmp/prod-test.env
export COMPOSE_ENV_FILES=/tmp/prod-test.env IMAGE_TAG=local
docker compose -f docker-compose.prod.yml build
./deploy/desplegar.sh --sin-pull                    # migraciones + up + health-check
docker compose -f docker-compose.prod.yml exec nginx nginx -t
curl -i http://localhost:8088/                      # index.html, Cache-Control: no-cache
curl -i http://localhost:8088/cualquier/ruta        # 200, fallback de la SPA
curl -s http://localhost:8088/api/health-check      # proxy al backend
curl -s -H 'Host: admin.localhost' http://localhost:8088/usuarios | grep '<title>'  # Cotizapp Admin
curl -s -H 'Host: admin.localhost' http://localhost:8088/robots.txt                # Disallow: /
docker compose -f docker-compose.prod.yml exec nginx grep client_max_body_size /etc/nginx/conf.d/default.conf  # 6m
docker compose -f docker-compose.prod.yml exec mysql \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" cotizapp -e "SELECT * FROM __drizzle_migrations"'
docker compose -f docker-compose.prod.yml down -v
unset COMPOSE_ENV_FILES IMAGE_TAG
```

Ojo: los volúmenes se llaman `cotizapp-mysql-data` y `cotizapp-uploads`
(nombres fijos) y `down -v` los borra. **Nunca usar `-v` en el droplet.**

## Desarrollo local: contenedores sin root

El `docker-compose.yml` de desarrollo corre `backend`, `ecommerce` y
`admin-site` con el usuario del host (`DEV_UID:DEV_GID`, default
`1000:1000`), para que lo que escriben en el bind mount (`packages/*/dist`,
`.angular/cache`, `.turbo`, `.pnpm-store`) no quede de root y no rompa un
`pnpm build` hecho fuera de Docker. El servicio de un solo uso
`fix-permissions` le cambia el dueño a los volúmenes de `node_modules` antes
de que arranquen los demás.

Si tu `id -u` no es 1000 (desde `Proyecto/`):

```bash
printf 'DEV_UID=%s\nDEV_GID=%s\n' "$(id -u)" "$(id -g)" >> .env
```

Limpieza única de lo que dejaron los contenedores antiguos como root:

```bash
sudo chown -R "$(id -u):$(id -g)" Proyecto/   # desde la raíz del repo
```

## Pendiente

Epic KAN-88 (Plataforma), en este orden:

- KAN-160 — Respaldos automáticos de MySQL y del volumen `cotizapp-uploads`.
- KAN-159 — HTTPS con Let's Encrypt: código listo (dominio DuckDNS); falta activarlo en el droplet, ver [deploy/README.md](deploy/README.md#activar-https-kan-159).
- KAN-162 — Hardening del droplet.
- KAN-163 — Monitoreo y logs.
