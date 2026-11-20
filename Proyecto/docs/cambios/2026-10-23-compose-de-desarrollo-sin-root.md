# Compose de desarrollo sin root

**Fecha:** 2026-10-23 · **Épica:** KAN-88

Los contenedores `backend`, `ecommerce` y `admin-site` del
`docker-compose.yml` de desarrollo corren con el usuario del host
(`DEV_UID:DEV_GID`, default `1000:1000`). Un servicio de un solo uso,
`fix-permissions`, le cambia el dueño a los volúmenes de `node_modules`
antes de que arranquen los demás.

**Por qué**: corriendo como root dejaban archivos de root en el bind mount
(`packages/*/dist`, `.angular/cache`, `.turbo`, `.pnpm-store`), y después un
`pnpm build` hecho fuera de Docker fallaba por permisos.

**Si tu `id -u` no es 1000** o hay restos de root de antes, los comandos
están en [infra/README.md](../../infra/README.md#desarrollo-local-contenedores-sin-root).

**Toca**: `docker-compose.yml`.
