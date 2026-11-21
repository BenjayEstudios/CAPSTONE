#!/usr/bin/env bash
# Despliega en el droplet las imágenes ya publicadas en GHCR (KAN-161). Lo
# llama .github/workflows/deploy-dev.yml por SSH, después de dejar el clon en
# el commit a desplegar. También sirve a mano y para probar en local.
#
#   IMAGE_TAG=<sha> [GHCR_USER=<usuario> GHCR_TOKEN=<token>] infra/deploy/desplegar.sh [opciones]
#
#   --sin-migraciones  no corre migraciones (rollback: la base ya está más
#                      adelante que el código viejo)
#   --sin-pull         usa las imágenes que ya estén en el host (prueba local)
#
# CURL_EXTRA (opcional, solo pruebas locales): opciones extra para el curl del
# health-check, ej. CURL_EXTRA="--cacert cert.pem" con un certificado propio.
#
# Pasos: pull → migraciones (contenedor de una sola vez, debe terminar bien)
# → up sin build → health-check → logout → limpieza de imágenes viejas.
# El token de GHCR llega por variable de entorno y se le pasa a docker por
# stdin; nunca aparece como argumento.
set -euo pipefail

cd "$(dirname "$0")/.." # Proyecto/infra
: "${IMAGE_TAG:?Falta IMAGE_TAG (SHA del commit o "dev")}"
export IMAGE_TAG

migrar=1
pull=1
for opcion in "$@"; do
  case "$opcion" in
    --sin-migraciones) migrar=0 ;;
    --sin-pull) pull=0 ;;
    *) echo "Opción desconocida: $opcion" >&2; exit 2 ;;
  esac
done

compose() { docker compose -f docker-compose.prod.yml "$@"; }

# Falla acá (antes de tocar nada) si falta una variable en infra/.env.
compose config --quiet

if [ "$pull" = 1 ]; then
  if [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?Falta GHCR_USER}" --password-stdin >/dev/null
    trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  fi
  echo "==> Descargando imágenes ($IMAGE_TAG)"
  compose pull --quiet
fi

if [ "$migrar" = 1 ]; then
  echo "==> Migraciones"
  compose up -d --wait mysql
  compose run --rm --no-deps backend node packages/infrastructure/dist/db/migrar/run.js
fi

echo "==> Levantando el stack ($IMAGE_TAG)"
compose up -d --no-build --remove-orphans --wait --wait-timeout 180

# Health-check a través de Nginx, por el puerto que realmente publica. En
# modo HTTPS (KAN-159) el 80 solo redirige: se prueba por 443 con el dominio
# real resuelto a 127.0.0.1, así también se valida el certificado.
if compose exec -T nginx grep -q "listen 443" /etc/nginx/conf.d/default.conf; then
  dominio="$(compose exec -T nginx printenv APP_DOMAIN | tr -d '\r')"
  puerto="$(compose port nginx 443)"
  puerto="${puerto##*:}"
  url="https://${dominio}:${puerto}/api/health-check"
  resolver=(--resolve "${dominio}:${puerto}:127.0.0.1")
else
  puerto="$(compose port nginx 80)"
  puerto="${puerto##*:}"
  url="http://127.0.0.1:${puerto}/api/health-check"
  resolver=()
fi
read -r -a extra <<< "${CURL_EXTRA:-}"
for _ in $(seq 1 30); do
  if curl -fsS "${extra[@]}" "${resolver[@]}" "$url"; then
    echo
    docker image prune -f >/dev/null
    echo "==> Desplegado $IMAGE_TAG"
    exit 0
  fi
  sleep 5
done
echo "El backend no respondió /api/health-check tras el deploy" >&2
exit 1
