# infra/oracle — QA en Oracle Cloud Always Free

Entorno de QA adicional en una VM ARM gratuita de Oracle Cloud. Es el mismo
stack y el mismo deploy que en Digital Ocean ([../deploy/](../deploy/README.md)),
que queda intacto como plan B: Docker Compose con `nginx` + `backend` +
`mysql`, deploy por SSH con [`../deploy/desplegar.sh`](../deploy/desplegar.sh).

| Archivo | Qué es |
|---|---|
| [`cloud-init.yml`](cloud-init.yml) | Prepara la VM en su primer arranque (Docker, usuario `deploy`, iptables 80/443, clon del repo, `infra/.env` con secretos generados ahí e `IMAGE_TAG=dev-arm64`). |
| [`../../../.github/workflows/deploy-oracle.yml`](../../../.github/workflows/deploy-oracle.yml) | Construye las imágenes ARM y despliega. Apagado hasta `ORACLE_ENABLED=true`. |

## Qué cambia respecto de Digital Ocean

| | Digital Ocean | Oracle |
|---|---|---|
| Costo | ≈ US$7,14/mes con IVA | **US$0** dentro de los límites Always Free |
| VM | 1 vCPU, 1 GB, x86 | ARM (Ampere A1), recomendado 1 OCPU y 3 GB |
| Región | New York | Santiago (si es la región de origen de la cuenta) |
| Imágenes | `:<sha>` y `:dev` (x86, de `deploy-dev.yml`) | `:<sha>-arm64` y `:dev-arm64` (de `deploy-oracle.yml`) |
| Firewall | `ufw` en el droplet | Security List de la VCN **y** iptables de la imagen de Oracle |
| Secrets | `DEPLOY_*` | `ORACLE_*` en el environment `qa-oracle` |

Las imágenes ARM se construyen en un runner ARM nativo de GitHub
(`ubuntu-24.04-arm`, gratis en repos públicos), con los mismos Dockerfiles;
no hay emulación. Las imágenes base (`node:22-alpine`, `nginx:1.30-alpine`,
`mysql:8.4`) tienen variante arm64 y el backend no tiene dependencias
nativas.

## Límites Always Free (documentación de Oracle, noviembre 2026)

- Ampere A1: 1.500 OCPU-hora y 9.000 GB-hora al mes = **2 OCPU y 12 GB** en
  total (en 2026 Oracle bajó esto a la mitad sin anuncio; revisar antes de
  agrandar la VM). Si se pasa, Oracle deshabilita las VMs A1 y las borra a
  los 30 días.
- Disco: 200 GB en total entre discos de arranque y volúmenes, 5 respaldos.
- Tráfico de salida: 10 TB/mes. IP pública incluida.
- La VM gratis solo se crea en la **región de origen**, que se elige al crear
  la cuenta y no se cambia.

### Riesgos

- **VM "inactiva" recuperada**: Oracle puede recuperar una VM Always Free si
  en 7 días el percentil 95 de CPU, de red **y** de memoria (las tres) queda
  bajo 20 %. Un QA con poco uso cae fácil en CPU y red; por eso se recomienda
  **3 GB** de RAM: el stack (MySQL + backend + Nginx + sistema) usa cerca de
  1 GB, sobre el 20 %. Con 12 GB quedaría bajo el umbral. Igual, los
  respaldos de la base (KAN-160) deben vivir fuera de la VM.
- **"Out of host capacity"** al crear la VM: falta temporal de capacidad
  gratis en la región. Reintentar más tarde; el plan B es Digital Ocean.
- **No pasar la cuenta a Pay As You Go** sin decidirlo en equipo: desde ahí
  cualquier exceso se cobra.

## Crear la VM

1. **Cuenta**: oracle.com/cloud/free. Región de origen: **Chile Central
   (Santiago)**. Piden celular y tarjeta (solo verificación; no se cobra si
   la cuenta no se pasa a pago).

2. **Llave del deploy** (en tu máquina, fuera del repo):

   ```bash
   ssh-keygen -t ed25519 -N "" -C deploy-cotizapp-oracle -f ~/.ssh/cotizapp_oracle
   cat ~/.ssh/cotizapp_oracle.pub     # esta línea va en el cloud-init
   ```

3. **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04** (no "Minimal": la normal trae
     `iptables-persistent`).
   - Shape: **Ampere → VM.Standard.A1.Flex**, 1 OCPU, 3 GB. Debe decir
     "Always Free-eligible".
   - Networking: crear VCN y subred **pública**, con IPv4 pública asignada.
   - SSH keys: tu llave personal (entra como `ubuntu` a administrar).
   - Boot volume: el default (50 GB) está dentro del límite gratis.
   - *Show advanced options → Management → Paste cloud-init script*: pegar
     [`cloud-init.yml`](cloud-init.yml) con `CLAVE_PUBLICA_DEPLOY` reemplazado
     por la línea del paso 2.

4. **Abrir 80 y 443 en la VCN**: Networking → Virtual Cloud Networks → (la
   VCN) → Security Lists → Default → *Add Ingress Rules*: origen `0.0.0.0/0`,
   TCP, puerto destino `80`; otra igual con `443`. (El 22 ya viene abierto.)

5. **Revisar** (~5 minutos después):

   ```bash
   ssh ubuntu@<ip>
   cloud-init status --wait                 # status: done
   sudo cat /var/log/cotizapp-preparacion.log   # "compose config OK" y "Listo"
   ```

   Si el log dice `AVISO: no se pudo leer la IP pública`, editar
   `APP_DOMAIN`/`ADMIN_DOMAIN` en `/opt/cotizapp/Proyecto/infra/.env`.

6. **Fingerprint del servidor** (para `ORACLE_KNOWN_HOSTS`, sin aceptar a
   ciegas). Compararlo por un canal distinto al SSH: en la consola de OCI,
   la instancia → *Console history → Capture console history* muestra el
   bloque `BEGIN SSH HOST KEY FINGERPRINTS` que imprime cloud-init. En tu
   máquina:

   ```bash
   ssh-keyscan -t ed25519 <ip> > known_hosts_oracle
   ssh-keygen -lf known_hosts_oracle        # el SHA256:... de ED25519 debe coincidir
   ```

7. **Probar la llave del deploy**:

   ```bash
   ssh -i ~/.ssh/cotizapp_oracle -o UserKnownHostsFile=known_hosts_oracle deploy@<ip> docker ps
   ```

## Configuración en GitHub (admin del repo)

Settings → Environments → **`qa-oracle`** (nuevo), con estos secrets:

| Nombre | Tipo | Valor |
|---|---|---|
| `ORACLE_HOST` | secret | IP pública de la VM. |
| `ORACLE_USER` | secret | `deploy`. |
| `ORACLE_SSH_KEY` | secret | Contenido de `~/.ssh/cotizapp_oracle` (privada). Después borrarla del disco. |
| `ORACLE_KNOWN_HOSTS` | secret | Contenido de `known_hosts_oracle` (paso 6). |
| `ORACLE_DEPLOY_PATH` | variable (opcional) | Default `/opt/cotizapp`. |
| `ORACLE_ENABLED` | variable de repositorio | `true` para activar build y deploy. |

Los paquetes de GHCR son los mismos que usa Digital Ocean
(`cotizapp-backend`, `cotizapp-nginx`); los tags ARM solo agregan versiones.

## Cómo funciona `deploy-oracle.yml`

En cada push a `dev` (con `ORACLE_ENABLED=true`), en paralelo e independiente
de `deploy-dev.yml`:

1. **build** (runner `ubuntu-24.04-arm`): backend y nginx → GHCR con tags
   `<sha>-arm64` y `dev-arm64`. Caché `type=gha` con scope propio.
2. **deploy** (environment `qa-oracle`): SSH a la VM, clon al commit y
   `IMAGE_TAG=<sha>-arm64 desplegar.sh` → pull, migraciones, `up` sin build,
   health-check.

**Rollback**: *Actions → Deploy QA Oracle → Run workflow* (rama `dev`) con
`tag` = SHA completo. Sin build ni migraciones. Solo sirve con SHAs que ya
tengan imagen `-arm64` (desplegados con este workflow).

A mano en la VM, sin `IMAGE_TAG` el compose usa el `IMAGE_TAG=dev-arm64` del
`.env`. Nunca usar las imágenes sin `-arm64` acá: son x86 y no arrancan.

## Validación (local, 2026-11-19)

- actionlint 1.7.12: 0 errores. `cloud-init schema`: válido. shellcheck
  v0.11.0 del script embebido: OK.
- Script corrido en un contenedor `ubuntu:24.04` con las mismas reglas
  iptables de la imagen de Oracle (REJECT al final de INPUT): inserta 80 y
  443 justo antes del REJECT, las persiste en `/etc/iptables/rules.v4`, una
  segunda corrida no las duplica, instala Docker + Compose, clona y genera
  `.env` 600 con dominios nip.io e `IMAGE_TAG=dev-arm64`.
- Compose con ese `.env`: imágenes `…:dev-arm64`; con `IMAGE_TAG=<sha>-arm64`
  del deploy, `…:<sha>-arm64`.
- `mysql:8.4`, `node:22-alpine` y `nginx:1.30-alpine` publican arm64.
- **Sin probar**: el build en el runner ARM, la VM real de Oracle (firewall
  de la VCN, IP, fingerprint por *Console history*) y el workflow en GitHub.
