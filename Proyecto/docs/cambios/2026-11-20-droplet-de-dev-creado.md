# Droplet de dev creado en Digital Ocean

**Fecha:** 2026-11-20 · **Épica:** KAN-88 · **Ticket:** KAN-161

Se creó `cotizapp-dev` (NYC1, Basic 1 GB, US$6/mes, Ubuntu 24.04, IP
`167.71.17.12`) con la llave personal de Samuel para `root` y el
`cloud-init.yml` como startup script. El equipo eligió Digital Ocean para el
entorno `dev` (que es el de QA); lo de Oracle queda en el repo sin usar.

**Problema:** cloud-init no aplicó nada (`degraded done`, `unacceptable
character #x0086`). Digital Ocean recodificó mal las tildes y la flecha `→`
de los comentarios y cloud-init descarta el YAML completo. **Arreglo:**
`infra/deploy/cloud-init.yml` e `infra/oracle/cloud-init.yml` quedan solo
ASCII (con un comentario que lo advierte), y este droplet se preparó por SSH
como root con los mismos pasos: usuario `deploy` con su llave y el script de
`write_files`.

**Verificado en el droplet**: Docker 29.10 + Compose v5.8; `deploy` en el
grupo `docker`, sin password; `ufw` con 22/80/443; swap de 2 GB; clon en
`/opt/cotizapp` de `deploy`; `.env` 600 con dominios
`167.71.17.12.nip.io` y los 3 secretos de 64 hex; `PasswordAuthentication
no`; `ssh deploy@167.71.17.12 docker ps` entra con la llave del deploy. El
fingerprint ED25519 de `ssh-keyscan` coincide con el que muestra
`ssh-keygen -lf` en la consola web de DO.

**Falta**: commit de KAN-161 hasta `dev`, secrets del environment `dev`
(`DEPLOY_HOST=167.71.17.12`, `DEPLOY_USER=deploy`, `DEPLOY_SSH_KEY`,
`DEPLOY_KNOWN_HOSTS`) y `DEPLOY_ENABLED=true`.

**Toca**: `infra/deploy/cloud-init.yml`, `infra/oracle/cloud-init.yml`,
`infra/deploy/README.md`.
