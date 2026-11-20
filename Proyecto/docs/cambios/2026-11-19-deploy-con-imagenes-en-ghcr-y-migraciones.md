# Deploy con imágenes en GHCR y migraciones

**Fecha:** 2026-11-19 · **Épica:** KAN-88 · **Ticket:** KAN-161

Cierra lo que faltaba del pipeline: el droplet ya no compila y el deploy
aplica las migraciones de Drizzle antes de levantar el backend nuevo.

**Imágenes en GHCR** (`.github/workflows/deploy-dev.yml`):

- Job nuevo `build` (matriz backend/nginx): docker buildx con caché
  `type=gha`, publica `ghcr.io/benjayestudios/cotizapp-backend` y
  `cotizapp-nginx` con tag = SHA del commit y `dev`, y la label
  `org.opencontainers.image.source`. `GITHUB_TOKEN` con `packages: write`
  solo en ese job. Corre en push a `dev` y en *Run workflow* desde `dev`,
  aunque el deploy esté apagado.
- Job `deploy` con `needs: build` y la misma compuerta `DEPLOY_ENABLED`, con
  `packages: read`. El token de GHCR viaja al droplet por la entrada estándar
  del SSH, nunca como argumento.
- Rollback: input opcional `tag` en *Run workflow* (SHA completo). No
  construye nada ni corre migraciones.
- `infra/docker-compose.prod.yml`: `image:` con `${IMAGE_TAG:-dev}` en nginx
  y backend; conserva `build:` para probar en local.

**Lógica del deploy en un script** (`infra/deploy/desplegar.sh`): login →
pull → migraciones (contenedor de una sola vez; si falla se detiene y sigue
la versión anterior) → `up -d --no-build --remove-orphans --wait` →
health-check → logout → `image prune`. Antes vivía inline en el workflow; como
script se prueba en local igual que corre en el droplet (`--sin-pull`).

**Migraciones** (`packages/infrastructure/src/db/migrar/`): script con el
migrator de drizzle-orm, el mismo que usa `drizzle-kit migrate`, compilado a
`dist/` y con `migrations/` copiada a la imagen del backend (drizzle-kit no
está en runtime). Antes de migrar revisa el historial completo y se niega
si hay filas desconocidas (lo que pasó en Aiven), migraciones salteadas o
tablas sin historial. Después asegura las particiones de `evento_analitico`;
para eso, la parte de base de `particiones/run.ts` pasó a
`particiones/asegurar.ts`, que usan los dos.

**Droplet en un paso** (`infra/deploy/cloud-init.yml`, guía y costos en
`infra/deploy/README.md`): se pega al crear el droplet y deja Docker + Compose,
usuario `deploy` (solo llave, grupo `docker`), `ufw` 22/80/443, 2 GB de swap,
el clon en `/opt/cotizapp` e `infra/.env` con secretos generados en el droplet
(no pasan por ningún computador ni chat) y dominios `<ip>.nip.io` hasta
KAN-159. El fingerprint para `DEPLOY_KNOWN_HOSTS` se compara con
`ssh-keygen -lf` dentro del droplet (la consola de DO no lo muestra).

**Por qué**: un `ng build` en un droplet chico puede quedarse sin RAM; con
imágenes por SHA el deploy es reproducible y el rollback no compila. El
migrator de drizzle solo mira la última fila del historial y con un
historial ajeno falla en silencio. Decisiones en
[cerradas](../decisiones/DECISIONES-CERRADAS.md).

**Validación (local)**:

- actionlint: 0 errores en los dos workflows; shellcheck OK en `desplegar.sh`.
- Las dos imágenes se construyen con los mismos Dockerfiles; la del backend
  trae `migrations/` y `dist/db/migrar/` y no trae drizzle-kit.
- `desplegar.sh --sin-pull` sobre una base vacía: aplica las 2 migraciones,
  particiones hasta 2027-02, `/api/health-check` 200.
- `__drizzle_migrations` queda con una fila por entrada del journal: `hash` =
  `sha256sum` de cada `.sql` y `created_at` = `when`, idéntico a la base de
  desarrollo migrada con drizzle-kit. `drizzle-kit migrate` real sobre la base
  de prueba no aplica nada (intercambiables en los dos sentidos).
- Segunda corrida: "2 aplicada(s), 0 pendiente(s)"; segundo deploy completo OK.
- Fila inventada en `__drizzle_migrations` (fecha anterior y posterior):
  falla con exit 1 en el paso de migraciones, antes del `up`. Base con tablas
  y sin historial: también falla.
- Rollback (`--sin-migraciones`) OK; un tag inexistente falla sin construir
  y deja corriendo la versión anterior.
- El token pasado por stdin llega entero y no aparece en el `cmdline` de
  ningún proceso.
- `pnpm check-types` del monorepo: 9/9. Tests de `packages/infrastructure`:
  33/34; falla `analitica.repository.test.ts › …podan particiones` por el
  índice que elige el optimizador en la base de desarrollo (no toca este
  cambio; la poda de particiones sí ocurre).

- `cloud-init.yml`: `cloud-init schema` válido; shellcheck OK del script
  embebido; corrido en `ubuntu:24.04` con systemd/ufw/swap simulados: instala
  Docker, crea `.env` 600 con dominios nip.io y `compose config` pasa.

**Sin probar** (no hay droplet ni se puede publicar desde local): el push a
GHCR, el `docker login`/`pull` contra GHCR, el SSH y la ejecución del
workflow en GitHub.

**Toca**: `.github/workflows/deploy-dev.yml`,
`infra/docker-compose.prod.yml`, `infra/deploy/desplegar.sh` (nuevo),
`infra/deploy/cloud-init.yml` (nuevo), `infra/deploy/README.md` (nuevo),
`infra/README.md`, `apps/backend/Dockerfile`, `apps/backend/README.md`,
`packages/infrastructure/src/db/migrar/{historial,run}.ts` (nuevo),
`packages/infrastructure/src/db/particiones/asegurar.ts` (nuevo),
`packages/infrastructure/src/db/particiones/run.ts`,
`packages/infrastructure/test/migrar.test.ts` (nuevo),
`packages/infrastructure/README.md`, `docs/decisiones/*`.
