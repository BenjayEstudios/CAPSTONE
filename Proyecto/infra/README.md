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
           │  /      → build  │  - estáticos de apps/ecommerce (SPA)
           │  /api/* → proxy ─┼──┐
           └──────────────────┘  │ red interna de Docker
                        ┌────────▼─────────┐
                        │     backend      │  imagen cotizapp-backend
                        │ Fastify :8000    │  (apps/backend/Dockerfile)
                        └────────┬─────────┘
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
| `docker-compose.prod.yml` | Stack de producción: `nginx`, `backend`, `mysql`. |
| `.env.example` | Variables de producción (dominio, passwords, JWT). Se copia a `infra/.env` en el droplet. |
| `nginx/Dockerfile` | Compila `apps/ecommerce` (Angular) y lo copia en una imagen `nginx:1.30-alpine`. |
| `nginx/templates/default.conf.template` | Config de Nginx (server blocks). La imagen oficial le aplica `envsubst` al arrancar (`${APP_DOMAIN}`). |
| `nginx/snippets/api-proxy.conf` | `location /api/` → backend (quita el prefijo `/api`). |
| `nginx/snippets/spa.conf` | Reglas de SPA: fallback a `index.html` y caché de assets con hash. |
| `../apps/backend/Dockerfile` | Imagen del backend (multi-stage, solo deps de producción, usuario `node`). |
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

Requisitos: droplet Ubuntu con Docker Engine + plugin Compose instalados.

```bash
# 1. Código (el repo es público: clon por HTTPS, el droplet no necesita llave de GitHub)
git clone https://github.com/BenjayEstudios/CAPSTONE.git /opt/cotizapp
cd /opt/cotizapp/Proyecto/infra
git checkout dev

# 2. Variables de producción
cp .env.example .env
# editar .env: APP_DOMAIN, y generar cada secreto con `openssl rand -hex 32`
chmod 600 .env

# 3. Validar y levantar
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verificar
docker compose -f docker-compose.prod.yml ps        # los 3 servicios "healthy"/"Up"
curl -s http://localhost/api/health-check           # {"status":"ok",...}
```

La base parte vacía: falta aplicar las migraciones de Drizzle (queda
automatizado en el deploy con KAN-161).

## Operación

```bash
cd /opt/cotizapp/Proyecto/infra
docker compose -f docker-compose.prod.yml logs -f backend      # logs
docker compose -f docker-compose.prod.yml up -d --build        # actualizar tras un git pull
docker compose -f docker-compose.prod.yml exec nginx nginx -t  # validar config de Nginx
docker compose -f docker-compose.prod.yml exec mysql \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" cotizapp'       # consola MySQL
```

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
| **Node** | pnpm (versión de `packageManager`), Node 22, caché de pnpm y de Turborepo. `pnpm install --frozen-lockfile` → `turbo run check-types lint build` → `turbo run test` (paquetes Node, vitest) → `ng test --browsers=ChromeHeadless` de ecommerce y admin-site. |
| **Flutter** | Solo si el PR/push toca `Proyecto/apps/mobile/**` (o el propio `ci.yml`). Flutter 3.47.5 stable: `flutter pub get`, `flutter analyze`, `flutter test`. Si no corre aparece como *skipped*, que GitHub cuenta como éxito. |

Los tests de Angular van en un paso aparte solo para agregarles
`--browsers=ChromeHeadless` (sin pantalla en el runner). Si las apps agregan
ese flag a su script `test`, el paso se puede fusionar con el de turbo.

Reproducir en local lo mismo que el job Node (desde `Proyecto/`):

```bash
CI=true pnpm install --frozen-lockfile
pnpm exec turbo run check-types lint build --continue
pnpm exec turbo run test --continue --filter='!@cotizapp/ecommerce' --filter='!@cotizapp/admin-site'
pnpm --filter @cotizapp/ecommerce --filter @cotizapp/admin-site run test --browsers=ChromeHeadless
```

Validar la sintaxis de los workflows (desde la raíz del repo):

```bash
docker run --rm -v "$PWD:/repo:ro" --workdir /repo rhysd/actionlint:1.7.12
```

**Recomendado (manual, en GitHub)**: Settings → Branches → reglas para
`main` y `dev` que exijan el check *Node (check-types, lint, test, build)*
antes de mergear.

### `deploy-dev.yml` — deploy al droplet (desactivado)

En cada `push` a `dev` (o a mano con *Run workflow*) entra por SSH al
droplet, deja el clon en el commit exacto, corre
`docker compose -f docker-compose.prod.yml up -d --build` y espera a que
`/api/health-check` responda. **No corre** mientras no exista la variable
`DEPLOY_ENABLED=true`.

Configuración en GitHub (Settings → Secrets and variables → Actions; los
secrets pueden ir en el environment `dev`, que el workflow ya declara):

| Nombre | Tipo | Valor |
|---|---|---|
| `DEPLOY_HOST` | secret | IP o dominio del droplet. |
| `DEPLOY_USER` | secret | Usuario de deploy en el droplet (ej. `deploy`, en el grupo `docker`, sin sudo). |
| `DEPLOY_SSH_KEY` | secret | Llave privada **dedicada** al deploy (ed25519, sin passphrase). |
| `DEPLOY_KNOWN_HOSTS` | secret | Salida de `ssh-keyscan -t ed25519 <ip>`; comparar el fingerprint con el que muestra la consola de DO. Evita aceptar a ciegas la llave del servidor. |
| `DEPLOY_PATH` | variable (opcional) | Ruta del clon en el droplet. Default `/opt/cotizapp`. |
| `DEPLOY_ENABLED` | variable | `true` para activar el deploy. |

Preparación en el droplet (una vez):

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/cotizapp && sudo chown deploy:deploy /opt/cotizapp
sudo -u deploy git clone https://github.com/BenjayEstudios/CAPSTONE.git /opt/cotizapp
# copiar Proyecto/infra/.env (ver "Primer despliegue") y la llave pública:
sudo -u deploy mkdir -p ~deploy/.ssh
echo "<contenido de id_deploy.pub>" | sudo -u deploy tee -a ~deploy/.ssh/authorized_keys
```

Generar la llave en tu máquina: `ssh-keygen -t ed25519 -N "" -C deploy-cotizapp -f id_deploy`
(la privada va a `DEPLOY_SSH_KEY`; después bórrala de tu disco).

Pendiente del resto de KAN-161: construir las imágenes en el runner y
publicarlas en GHCR (que el droplet no compile), y correr las migraciones de
Drizzle en el deploy.

## Probar el stack de producción en local

Sin tocar `infra/.env`, con un env de prueba y otro puerto:

```bash
cd Proyecto/infra
cat > /tmp/prod-test.env <<'EOF'
APP_DOMAIN=localhost
HTTP_PORT=8088
MYSQL_PASSWORD=testpass123
MYSQL_ROOT_PASSWORD=testroot123
JWT_SECRET=testjwt
EOF
docker compose -f docker-compose.prod.yml --env-file /tmp/prod-test.env up -d --build
docker compose -f docker-compose.prod.yml exec nginx nginx -t
curl -i http://localhost:8088/                      # index.html, Cache-Control: no-cache
curl -i http://localhost:8088/cualquier/ruta        # 200, fallback de la SPA
curl -s http://localhost:8088/api/health-check      # proxy al backend
docker compose -f docker-compose.prod.yml --env-file /tmp/prod-test.env down -v
```

Ojo: el volumen se llama `cotizapp-mysql-data` (nombre fijo) y `down -v` lo
borra. No usar `-v` en el droplet.

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

- KAN-168 — Servir el build de `apps/admin-site`.
- KAN-159 — HTTPS con Let's Encrypt.
- KAN-160 — Respaldos automáticos de MySQL.
- KAN-161 — Resto del pipeline: imágenes en GHCR + migraciones en el deploy
  (el CI de tests y el deploy desactivado ya están, ver "CI/CD").
- KAN-157 — Almacenamiento de imágenes y documentos.
- KAN-162 — Hardening del droplet.
- KAN-163 — Monitoreo y logs.
