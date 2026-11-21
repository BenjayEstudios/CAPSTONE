# infra/deploy — droplet y script de deploy

| Archivo | Qué es |
|---|---|
| [`cloud-init.yml`](cloud-init.yml) | Prepara un droplet nuevo en su primer arranque (Docker, usuario `deploy`, firewall, swap, clon del repo, `infra/.env` con secretos generados ahí). |
| [`certificado.sh`](certificado.sh) | Emite el certificado HTTPS de Let's Encrypt (una vez). Ver [Activar HTTPS](#activar-https-kan-159). |
| [`desplegar.sh`](desplegar.sh) | El deploy en sí: pull de GHCR → migraciones → `up` sin build → health-check. Lo llama `deploy-dev.yml` por SSH; ver [../README.md](../README.md#deploy-devyml--imágenes-en-ghcr-y-deploy-al-droplet). |

## Costo (precios de Digital Ocean, noviembre 2026)

| Qué | Costo | Nota |
|---|---|---|
| Droplet Basic 1 GB / 1 vCPU / 25 GB (**elegido**, entorno `dev` = QA) | US$6/mes | Alcanza porque el droplet no compila (las imágenes vienen de GHCR) y tiene 2 GB de swap. Incluye IPv4 y 1 TB de tráfico. |
| Droplet Basic 2 GB / 1 vCPU / 50 GB | US$12/mes | Si con 1 GB MySQL se queda corto (se cambia de tamaño sin recrear el droplet). |
| Droplet Basic 512 MB (US$4) | — | No sirve: MySQL 8.4 solo ya usa casi toda la RAM. |
| IVA (Chile, servicios digitales extranjeros) | +19 % | Lo cobra DO o el banco; además, la tarjeta puede cobrar comisión por compra en dólares. |
| Backups semanales de DO (opcional) | +20 % del droplet | Se decide en KAN-160. |
| GHCR, GitHub Actions | US$0 | Repo público: minutos de Actions y paquetes públicos gratis. |
| Dominio | US$0 por ahora | nip.io sobre la IP. Un dominio propio (KAN-159) se paga aparte por año (`.cl` en NIC Chile o `.com`), salvo que alguien del equipo tenga el GitHub Student Pack, que trae uno gratis por un año. |

Se cobra por segundo de existencia del droplet, **aunque esté apagado**; solo
deja de cobrar al **destruirlo**. Digital Ocean pide tarjeta o PayPal al crear
la cuenta. El crédito de DO del GitHub Student Pack ya no está disponible.

## Crear el droplet

1. **Llave del deploy** (en tu máquina, fuera del repo):

   ```bash
   ssh-keygen -t ed25519 -N "" -C deploy-cotizapp -f ~/.ssh/cotizapp_deploy
   cat ~/.ssh/cotizapp_deploy.pub     # esta línea va en el cloud-init
   ```

   La privada (`~/.ssh/cotizapp_deploy`) va después al secret
   `DEPLOY_SSH_KEY`. No se versiona ni se comparte por chat.

2. **Digital Ocean → Create → Droplets**:
   - Región: **New York** (la más cercana a Chile; DO no tiene región en
     Sudamérica).
   - Imagen: **Ubuntu 24.04 (LTS) x64**.
   - Tamaño: Basic → Regular → US$6 (1 GB). Sin backups de DO por ahora.
   - Autenticación: **SSH Key**, con tu llave personal (para entrar como
     `root` a administrar). No usar password.
   - *Advanced options → Add Initialization scripts*: pegar
     [`cloud-init.yml`](cloud-init.yml) completo, con `CLAVE_PUBLICA_DEPLOY`
     reemplazado por la línea del paso 1.
   - Hostname: `cotizapp-dev`.

3. **Esperar ~3 minutos** y revisar como root:

   ```bash
   ssh root@<ip>
   cloud-init status --wait                 # status: done
   cat /var/log/cotizapp-preparacion.log    # termina en "compose config OK" y "Listo"
   ```

4. **Fingerprint del servidor** (para `DEPLOY_KNOWN_HOSTS`, sin aceptar a
   ciegas). En el droplet, desde la sesión de root o desde la consola web de
   DO (*Access → Launch Droplet Console*):

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

   En tu máquina:

   ```bash
   ssh-keyscan -t ed25519 <ip> > known_hosts_cotizapp
   ssh-keygen -lf known_hosts_cotizapp      # debe mostrar el MISMO SHA256:...
   ```

   Si coinciden, el contenido de `known_hosts_cotizapp` va al secret
   `DEPLOY_KNOWN_HOSTS`.

5. **Probar la llave del deploy**:

   ```bash
   ssh -i ~/.ssh/cotizapp_deploy -o UserKnownHostsFile=known_hosts_cotizapp deploy@<ip> docker ps
   ```

   Debe responder con la tabla vacía de contenedores (sin pedir password).

6. Secrets y `DEPLOY_ENABLED` en GitHub: ver la tabla en
   [../README.md](../README.md#deploy-devyml--imágenes-en-ghcr-y-deploy-al-droplet).
   El primer deploy aplica las migraciones sobre la base vacía y levanta el
   stack en `http://<ip>.nip.io` y `http://admin.<ip>.nip.io`.

### Si el cloud-init no hizo nada

`cloud-init status --long` muestra `degraded done` y `Failed loading yaml
blob. unacceptable character`: el user-data no es ASCII puro. Digital Ocean
recodifica mal las tildes y símbolos (`á`, `→`) y cloud-init descarta el YAML
completo. Por eso `cloud-init.yml` es solo ASCII; no agregarle tildes. Para
un droplet ya creado, los mismos pasos se corren como root: crear `deploy` con
la llave y ejecutar el script de `write_files` (así se preparó el droplet
actual).

### Qué deja el cloud-init

- Docker Engine + plugin Compose desde el repo oficial de Docker.
- Usuario `deploy`: solo llave, sin password ni sudo, en el grupo `docker`
  (ojo: el grupo `docker` equivale a root en ese servidor; por eso la llave es
  dedicada y solo la usa el workflow).
- `ssh_pwauth: false`: nadie entra por SSH con password.
- Firewall `ufw`: 22, 80 y 443. MySQL no publica puertos.
- 2 GB de swap en `/swapfile`.
- `/opt/cotizapp`: clon del repo, del usuario `deploy`.
- `Proyecto/infra/.env` (600, de `deploy`): `APP_DOMAIN=<ip>.nip.io`,
  `ADMIN_DOMAIN=admin.<ip>.nip.io` (IP leída de la metadata del droplet) y los
  tres secretos con `openssl rand -hex 32`. **Se generan en el droplet y no
  salen de ahí**; si se necesitan (respaldos, consola MySQL), se leen ahí. Si
  el `.env` ya existe, no se toca.

No levanta el stack: eso lo hace el primer deploy, con las imágenes del
commit.

Sin cloud-init (droplet ya creado), los mismos pasos a mano están en el script
dentro de `cloud-init.yml` (`write_files`); se pueden correr como root.

## Activar HTTPS (KAN-159)

Dominio: **DuckDNS** (gratis). Un subdominio de DuckDNS también resuelve
todos sus sub-subdominios a la misma IP, así que basta con uno:
`cotizapp.duckdns.org` (ecommerce) y `admin.cotizapp.duckdns.org` (admin).
No sirve nip.io: Let's Encrypt comparte su límite de certificados con todo el
mundo (`certificado.sh` lo rechaza).

1. **DuckDNS** (duckdns.org, se entra con una cuenta de GitHub o Google):
   crear el subdominio y poner la IP del droplet. Comprobar desde cualquier
   máquina: `getent hosts cotizapp.duckdns.org admin.cotizapp.duckdns.org`
   → las dos con la IP del droplet. La IP es fija, así que no hace falta el
   script de actualización de DuckDNS.
2. **`infra/.env` del droplet** (como `deploy`): cambiar `APP_DOMAIN`,
   `ADMIN_DOMAIN` y, opcional, `LETSENCRYPT_EMAIL` (avisos de vencimiento).
   Dejar `PUBLIC_SCHEME=http` por ahora y aplicar:
   `docker compose -f docker-compose.prod.yml up -d`.
3. **Ensayo** contra el staging de Let's Encrypt (no guarda nada ni gasta
   límites): `./deploy/certificado.sh --prueba`.
4. **Certificado real**: `./deploy/certificado.sh` (acepta los términos de
   Let's Encrypt).
5. **Pasar a HTTPS**: `PUBLIC_SCHEME=https` en `infra/.env` y
   `docker compose -f docker-compose.prod.yml up -d`. Nginx pasa a 443 y
   redirige el 80; el backend arma sus URL (CORS, uploads, Webpay, links del
   admin) con `https`.
6. **Verificar**: `curl -I http://cotizapp.duckdns.org` → `301` a https;
   `curl https://cotizapp.duckdns.org/api/health-check` → `{"status":"ok"}`.

Después no hay que hacer nada: el servicio `certbot` intenta renovar cada
12 h (Let's Encrypt renueva desde 30 días antes del vencimiento) y Nginx
recarga cada 12 h. Los deploys siguientes validan el health-check por HTTPS.
Volver a HTTP: `PUBLIC_SCHEME=http` y `up -d`.

La app móvil apunta a `API_URL=https://cotizapp.duckdns.org/api`.

## Droplet actual

| Dato | Valor |
|---|---|
| Nombre | `cotizapp-dev` (NYC1, Basic 1 GB, Ubuntu 24.04), creado 2026-11-20 |
| IP | `167.71.17.12` → `http://167.71.17.12.nip.io`, `http://admin.167.71.17.12.nip.io` |
| Llave del host (ED25519) | `SHA256:VCscBviySg1va796paDUcKgO8ispJJYw7KY1fmdsNnc` (verificada en la consola web de DO) |
| Llave del deploy | `SHA256:KDDbWX7uGq003YZ8zfrsSBkiO+c2NMrglA/DYXJAdA0` (`deploy-cotizapp`) |

### Validación (local, 2026-11-19)

- `cloud-init schema -c cloud-init.yml`: válido.
- shellcheck v0.11.0 del script embebido: OK.
- El script corrido en un contenedor `ubuntu:24.04` (con `systemctl`, `ufw`
  y swap simulados, e IP de metadata falsa): instala Docker Engine + Compose,
  `deploy` queda en el grupo `docker`, clona el repo, genera `.env` 600 de
  `deploy` con dominios nip.io y secretos de 64 hex, y `docker compose config`
  pasa.
- Sin probar en un droplet real.
