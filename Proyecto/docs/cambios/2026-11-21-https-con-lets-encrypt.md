# HTTPS con Let's Encrypt (código)

**Fecha:** 2026-11-21 · **Épica:** KAN-88 · **Ticket:** KAN-159

Deja listo el paso a HTTPS sin activarlo: QA sigue en HTTP hasta tener el
dominio de DuckDNS apuntando al droplet y emitir el certificado.

**Qué cambió:**

- `PUBLIC_SCHEME` (`http` | `https`, default `http`) en `infra/.env` es el
  único interruptor. Lo leen Nginx y el compose, que arma con él
  `CORS_ORIGIN`, `ADMIN_SITE_URL`, `PUBLIC_BASE_URL` y el nuevo
  `PAGOS_RETORNO_BASE_URL=<esquema>://APP_DOMAIN/api` (retorno de Webpay,
  KAN-148: detrás de Nginx la API está bajo `/api`).
- Nginx con dos plantillas (`templates/http` y `templates/https`) y el
  contenido de cada sitio en snippets compartidos. `entrypoint/18-esquema.envsh`
  elige la plantilla; con `https` y sin certificado se queda en HTTP (así se
  puede emitir el primero) y lo avisa. En HTTPS: el 80 solo atiende el
  desafío de Let's Encrypt y redirige con 301; 443 con HTTP/2, TLS 1.2/1.3.
- Servicio `certbot` (`certbot/certbot:v5.9.0`) en el compose: intenta
  renovar cada 12 h por webroot; Nginx recarga cada 12 h
  (`entrypoint/40-recargar-certificados.sh`) para tomar el renovado, sin
  montar el socket de Docker. Volúmenes `cotizapp-letsencrypt` (respaldar con
  la base) y `cotizapp-acme`.
- `infra/deploy/certificado.sh`: emite el certificado (uno para los dos
  dominios, `--cert-name cotizapp`), con `--prueba` contra el staging. Rechaza
  nip.io/sslip.io y avisa si el DNS no apunta al droplet.
- `desplegar.sh`: en modo HTTPS el health-check va por 443 con el dominio
  real (valida también el certificado).
- Puerto 443 publicado (`HTTPS_PORT`, default 443); `ufw` ya lo tenía abierto.

**Por qué así:** se mantiene Nginx (que ya hace todo lo demás) en vez de
cambiarlo por Caddy o Traefik; el webroot no necesita API del DNS, y DuckDNS
está en la Public Suffix List, así que su límite de certificados no se
comparte. Decisión en [cerradas](../decisiones/DECISIONES-CERRADAS.md).

**Validación (local, 2026-11-21)**, imágenes construidas en local y
`cotizapp.test` resuelto a 127.0.0.1:

- Modo `http`: igual que antes (ecommerce 200, admin "Cotizapp Admin",
  health-check del deploy OK) y el desafío ACME responde en los dos dominios.
- `https` sin certificado: sigue en HTTP con el aviso en el log.
- `https` con un certificado autofirmado para los dos dominios: HTTP/2 200
  en ecommerce y admin, `robots.txt` del admin, `/api/health-check`; HTTP →
  `301` conservando ruta y query; ACME sigue respondiendo por el 80; TLS 1.1
  rechazado; `desplegar.sh` pasa el health-check por 443; el bucle de
  recarga queda corriendo. El backend recibe `https://` en
  `PUBLIC_BASE_URL`, `CORS_ORIGIN` y `PAGOS_RETORNO_BASE_URL`.
- certbot 5.9.0 arranca su bucle y se detiene limpio; `certificado.sh`
  rechaza nip.io y opciones desconocidas. shellcheck OK en los scripts.
- QA tiene 92 productos y ninguno guarda URL de imagen: cambiar de dominio
  no rompe nada.

**Sin probar**: la emisión real contra Let's Encrypt (necesita el dominio de
DuckDNS apuntando al droplet).

**Toca**: `infra/docker-compose.prod.yml`, `infra/.env.example`,
`infra/nginx/Dockerfile`, `infra/nginx/templates/{http,https}/default.conf.template`
(la de `http` es la antigua `templates/default.conf.template`, movida),
`infra/nginx/snippets/{comun,sitio-ecommerce,sitio-admin,acme,tls}.conf`
(nuevos), `infra/nginx/entrypoint/{18-esquema.envsh,40-recargar-certificados.sh}`
(nuevos), `infra/deploy/certificado.sh` (nuevo), `infra/deploy/desplegar.sh`,
`infra/README.md`, `infra/deploy/README.md`.
