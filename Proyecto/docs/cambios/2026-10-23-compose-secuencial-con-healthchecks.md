# Docker Compose de desarrollo levanta los servicios en secuencia

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Autor:** Sebastián Ramírez

Los servicios del `docker-compose.yml` de desarrollo ahora arrancan en
secuencia en vez de todos a la vez: `mysql` → `backend` → `ecommerce` →
`admin-site`, cada uno con `depends_on: condition: service_healthy` sobre el
anterior. El healthcheck de `backend` (8000) y `ecommerce` (4200) da healthy
cuando el puerto acepta conexiones, es decir, cuando ya terminó el
`pnpm install` inicial y el server arrancó.

**Por qué**: cada servicio corre `pnpm install` sobre el mismo bind mount; en
paralelo chocaban y fallaban con `ERR_PNPM_EIO`.

**Estado**: entró a `main` (commit `5e3ad58`). Al momento de escribir esta
entrada la rama `dev-smy` todavía no lo incorpora: hay que traer `main` antes
del próximo PR.

**Toca**: `docker-compose.yml`.
