# infra

Despliegue en un único droplet de Digital Ocean, todo containerizado con
Docker: **Nginx (reverse proxy) + API (Fastify) + MySQL**.

Este folder es un punto de partida, no un pipeline de CI/CD terminado.

## Componentes

- `docker-compose.prod.yml` — orquesta `nginx`, `rest` y `mysql` en el droplet.
- `nginx/nginx.conf` — reverse proxy: expone la API bajo `/api/`. El frontend
  Angular (`apps/web`) se buildea (`ng build`) y sus estáticos se sirven por
  separado (otro `location /` en Nginx, o un servicio de estáticos aparte) —
  todavía no definido en este stub.

## Variables de entorno esperadas

`apps/rest/.env` (mismo formato que `.env.example`, con `DATABASE_URL`
apuntando al servicio `mysql` interno) y, para `docker-compose.prod.yml`:

```
MYSQL_PASSWORD=...
MYSQL_ROOT_PASSWORD=...
```

## Pendiente

- Definir cómo se sirven los estáticos de `apps/web` (Nginx propio vs. bucket/CDN).
- HTTPS (Let's Encrypt / Certbot).
- Backups de `cotizapp-mysql-data`.
