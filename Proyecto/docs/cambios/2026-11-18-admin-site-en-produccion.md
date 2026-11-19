# admin-site en producción, en su propio subdominio

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-168

- `infra/nginx/Dockerfile` ahora compila también `apps/admin-site` y lo copia
  a `/usr/share/nginx/html/admin-site`. Una sola imagen de Nginx con los dos
  frontends.
- Nuevo `server` en `infra/nginx/templates/default.conf.template` para
  `${ADMIN_DOMAIN}`: SPA con fallback a `index.html`, el mismo `/api/`
  proxeado al backend y un `robots.txt` que bloquea a los buscadores. El
  ecommerce sigue siendo el `default_server`.
- `infra/docker-compose.prod.yml` exige `ADMIN_DOMAIN` y le pasa al backend
  `ADMIN_SITE_URL` (link de las invitaciones) y `CORS_ORIGIN` con los dos
  dominios.
- `infra/.env.example`: `ADMIN_DOMAIN`, y cómo usar nip.io mientras no haya
  dominio propio.

**Por qué subdominio y no `/admin/`**: el panel guarda su JWT en
`localStorage`, que es por origen; en otro origen, un XSS en el ecommerce no
alcanza el token de un administrador. Además no hay que tocar la app
(`--base-href`) y el panel se puede restringir por separado. Detalle en
[decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md).

**Correcciones de paso** (el stack de producción de `main` no arrancaba):

- El backend se caía al iniciar con `EACCES: mkdir '/repo/uploads'`: el
  código de subida de archivos usa `UPLOADS_DIR=./uploads` y en la imagen
  `/repo` es de root, pero el proceso corre como `node`. La imagen ahora
  crea `/data/uploads` (de `node`) y fija `UPLOADS_DIR=/data/uploads`. El
  volumen persistente encima es KAN-157.
- El compose pasaba `CORS_ORIGINS` (plural), pero el backend volvió a leer
  `CORS_ORIGIN` (singular): en producción quedaban los orígenes de
  `localhost` por defecto. Ahora pasa `CORS_ORIGIN`.

**Validación (local, puerto 8088)**: `nginx -t` OK; `Host: localhost` sirve
el ecommerce y `Host: admin.localhost` el panel (`<title>` distinto);
`/usuarios` y `/login` del panel caen en `index.html`; `/api/health-check`
responde desde los dos dominios; `robots.txt` del panel con `Disallow: /`;
assets con hash `immutable`; un host desconocido cae en el ecommerce; el
backend arranca con `/data/uploads` de `node`.

**Toca**: `infra/nginx/Dockerfile`, `infra/nginx/templates/default.conf.template`,
`infra/docker-compose.prod.yml`, `infra/.env.example`, `infra/README.md`,
`apps/backend/Dockerfile`.
