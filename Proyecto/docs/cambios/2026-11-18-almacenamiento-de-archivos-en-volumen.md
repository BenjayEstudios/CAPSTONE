# Archivos subidos en un volumen, servidos por Nginx

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-157

- Nuevo volumen `cotizapp-uploads` (nombre fijo) en
  `infra/docker-compose.prod.yml`: el backend lo monta en `/data/uploads`
  (lectura/escritura) y Nginx en `/srv/uploads` (solo lectura). Antes los
  archivos vivían dentro del contenedor y se perdían al recrearlo.
- El backend recibe `STORAGE_DRIVER=local`, `UPLOADS_DIR=/data/uploads`,
  `UPLOADS_MAX_MB` y `PUBLIC_BASE_URL=http://${APP_DOMAIN}`, así que las URL
  quedan como `http://<dominio>/uploads/productos/<id>/<uuid>.png`.
- Nuevo `infra/nginx/snippets/uploads.conf`, incluido en los dos dominios:
  sirve **solo** `/uploads/productos/<id>/<archivo>.jpg|png`, con caché
  inmutable (el nombre es un UUID), `X-Content-Type-Options: nosniff` y
  `Content-Security-Policy: sandbox`. Todo lo demás bajo `/uploads/` da 404.
- `/api/uploads/` da 404: el static del backend no tiene auth y en
  producción los archivos los sirve Nginx.
- Límite de tamaño con una sola variable, `UPLOADS_MAX_MB` (default 5, en
  `infra/.env`): el backend rechaza con su 413 y Nginx corta el body en
  `UPLOADS_MAX_MB + 1` MB (holgura para el envoltorio multipart), con un 413
  en el mismo JSON `{error:{code,message}}` del backend. El cálculo lo hace
  `infra/nginx/entrypoint/19-limite-subidas.envsh`, que valida que sea entero.
  Reemplaza el `client_max_body_size 25m` fijo, que venía de una variable
  vieja (`FILE_UPLOAD_MAX_MB`) que el backend ya no lee.

**Por qué volumen y no DO Spaces**: ver
[decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md). En corto: el
adaptador local ya existe, es gratis y se respalda con la base; Spaces cuesta
y requiere escribir otro adaptador en el backend.

**Pendiente fuera de infra**:

- Los **documentos de proveedor** (KAN-150) no tienen endpoint todavía. No
  deben servirse por `/uploads/` (Nginx solo publica `productos/`), sino por
  una ruta con auth.
- `producto.imagenes` guarda la **URL absoluta**. Si cambia el dominio o se
  pasa a `https` (KAN-159), las URL ya guardadas se rompen. Ver
  [decisiones abiertas](../decisiones/DECISIONES-ABIERTAS.md#5-dominio-y-https).
- El volumen `cotizapp-uploads` entra en los respaldos (KAN-160).

**Validación (local, puerto 8088)**: `nginx -t` OK, tope calculado `6m`; el
backend (usuario `node`) escribe en el volumen; Nginx sirve la imagen en los
dos dominios con bytes idénticos y los headers esperados; dan 404
`/uploads/`, carpetas, archivos inexistentes, otras carpetas, `.html`, `.svg`
y `/api/uploads/…`; los intentos de `../` (también codificados) caen en el
`index.html` de la SPA, nunca en el disco; Nginx no puede escribir el
volumen; un POST de 7 MB recibe el 413 JSON de Nginx y uno de 5,5 MB llega
al backend; la imagen sigue ahí tras recrear backend y Nginx;
`UPLOADS_MAX_MB=abc` hace fallar el arranque con un mensaje claro.

**Toca**: `infra/docker-compose.prod.yml`, `infra/.env.example`,
`infra/nginx/Dockerfile`, `infra/nginx/templates/default.conf.template`,
`infra/nginx/snippets/api-proxy.conf`, `infra/nginx/snippets/uploads.conf`
(nuevo), `infra/nginx/entrypoint/19-limite-subidas.envsh` (nuevo),
`infra/README.md`.
