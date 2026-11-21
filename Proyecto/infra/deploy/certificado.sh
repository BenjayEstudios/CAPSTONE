#!/usr/bin/env bash
# Emite el certificado HTTPS de Let's Encrypt (KAN-159) para APP_DOMAIN y
# ADMIN_DOMAIN de infra/.env, con un solo certificado (--cert-name cotizapp).
# Se corre UNA vez en el droplet, como deploy; después lo renueva solo el
# servicio certbot del compose.
#
#   infra/deploy/certificado.sh --prueba   # ensayo contra el staging de Let's Encrypt
#                                          # (no guarda nada ni gasta límites)
#   infra/deploy/certificado.sh            # emite el certificado real
#
# Requisitos: los dos dominios apuntan a este droplet (registro DNS), el
# puerto 80 está abierto y el stack corriendo (Nginx sirve el desafío
# HTTP-01 en /.well-known/acme-challenge/ en modo HTTP y en modo HTTPS).
# Al emitir el real se aceptan los términos de Let's Encrypt (--agree-tos).
# Después: PUBLIC_SCHEME=https en infra/.env y `docker compose up -d`.
set -euo pipefail

cd "$(dirname "$0")/.." # Proyecto/infra

prueba=0
case "${1:-}" in
  --prueba) prueba=1 ;;
  "") ;;
  *) echo "Uso: $0 [--prueba]" >&2; exit 2 ;;
esac

compose() { docker compose -f docker-compose.prod.yml "$@"; }

# Dominios y correo desde infra/.env (vía compose, igual que el stack). La
# salida trae secretos: se filtra sin imprimirla.
entorno="$(compose config --environment)"
valor() { printf '%s\n' "$entorno" | sed -n "s/^$1=//p" | tail -n 1; }
app="$(valor APP_DOMAIN)"
admin="$(valor ADMIN_DOMAIN)"
correo="$(valor LETSENCRYPT_EMAIL)"

for d in "$app" "$admin"; do
  if [ -z "$d" ]; then echo "Falta APP_DOMAIN o ADMIN_DOMAIN en infra/.env" >&2; exit 1; fi
  case "$d" in
    *.nip.io|*.sslip.io)
      echo "$d es de nip.io/sslip.io: Let's Encrypt comparte el límite de ese dominio con todo el mundo. Usar un dominio propio (KAN-159)." >&2
      exit 1 ;;
  esac
done

# Aviso (no bloquea) si el DNS todavía no apunta a este droplet.
ip_publica="$(curl -fsS --max-time 5 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || true)"
for d in "$app" "$admin"; do
  resuelve="$(getent ahostsv4 "$d" | awk 'NR==1 {print $1}')"
  if [ -n "$ip_publica" ] && [ "$resuelve" != "$ip_publica" ]; then
    echo "AVISO: $d resuelve a '${resuelve:-nada}' y este droplet es $ip_publica. Let's Encrypt va a fallar si no apunta acá." >&2
  fi
done

if [ -n "$correo" ]; then
  registro=(--email "$correo")
else
  registro=(--register-unsafely-without-email)
fi

opciones=(certonly --webroot -w /var/www/acme --cert-name cotizapp
  -d "$app" -d "$admin" --non-interactive --agree-tos "${registro[@]}")
if [ "$prueba" = 1 ]; then
  opciones+=(--dry-run)
  echo "==> Ensayo (staging de Let's Encrypt) para $app y $admin"
else
  echo "==> Emitiendo certificado para $app y $admin"
fi

compose run --rm -T --no-deps --entrypoint certbot certbot "${opciones[@]}"

if [ "$prueba" = 1 ]; then
  echo "==> Ensayo OK. Para el real: $0"
  exit 0
fi

# Nginx elige la plantilla al arrancar: si ya tenía PUBLIC_SCHEME=https,
# un restart basta para que pase a 443 con el certificado nuevo.
if [ -n "$(compose ps -q nginx)" ]; then
  compose restart nginx
fi

if [ "$(valor PUBLIC_SCHEME)" = "https" ]; then
  echo "==> Certificado emitido y Nginx reiniciado: el sitio ya está en HTTPS."
else
  echo "==> Certificado emitido. Siguiente paso: PUBLIC_SCHEME=https en infra/.env y"
  echo "    docker compose -f docker-compose.prod.yml up -d   (Nginx pasa a 443 y redirige el 80)"
fi
