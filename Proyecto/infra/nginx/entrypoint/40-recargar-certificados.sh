#!/bin/sh
# KAN-159. Solo en modo HTTPS: recarga Nginx cada 12 h para que tome el
# certificado que renovó el servicio certbot (sin acceso al socket de Docker,
# certbot no puede avisarle). Un reload no corta conexiones. El bucle queda
# como hijo del proceso nginx (PID 1) y muere con el contenedor.
if grep -q "listen 443" /etc/nginx/conf.d/default.conf 2>/dev/null; then
    (while sleep 43200; do nginx -s reload; done) &
    echo "$0: recarga de certificados cada 12 h activada"
fi
