# QA adicional en Oracle Cloud Always Free

**Fecha:** 2026-11-19 · **Épica:** KAN-88 · **Ticket:** KAN-161

Segundo destino de deploy, gratis, sin tocar el de Digital Ocean (que queda
como plan B). La cuenta de DO no tiene créditos y el droplet más barato que
sirve cuesta ≈ US$7,14/mes con IVA; Oracle Always Free da una VM ARM de
hasta 2 OCPU y 12 GB por US$0, con región en Santiago.

**Qué se agregó:**

- `.github/workflows/deploy-oracle.yml`: en push a `dev`, build de backend y
  nginx en un runner ARM nativo (`ubuntu-24.04-arm`) → GHCR con tags
  `<sha>-arm64` y `dev-arm64`; luego deploy por SSH con
  `IMAGE_TAG=<sha>-arm64 infra/deploy/desplegar.sh`. Rollback por
  *Run workflow* con `tag`. Environment `qa-oracle`, secrets `ORACLE_*`.
  Todo apagado hasta la variable `ORACLE_ENABLED=true`.
- `infra/oracle/cloud-init.yml`: variante del de DO para la imagen Ubuntu de
  Oracle: abre 80/443 en sus iptables (antes del REJECT, persistido antes de
  instalar Docker), IP pública leída de `checkip.amazonaws.com` (la metadata
  de OCI solo da la privada) e `IMAGE_TAG=dev-arm64` en `.env`.
- `infra/oracle/README.md`: límites, riesgos (recuperación de VMs inactivas,
  capacidad, cambios de Oracle), creación de la VM, Security List,
  fingerprint por *Console history* y secrets.

**Por qué así:** un workflow aparte en vez de imágenes multi-arch en
`deploy-dev.yml` deja intacto lo de DO y evita emular ARM con QEMU (el build
de Angular sería muchas veces más lento). Duplica minutos de build, que son
gratis en un repo público. Decisión en
[cerradas](../decisiones/DECISIONES-CERRADAS.md).

**Validación (local)**: actionlint 0 errores; `cloud-init schema` válido;
shellcheck OK; script corrido en `ubuntu:24.04` con las reglas iptables de
Oracle: inserta 80/443 antes del REJECT, persiste, es idempotente, genera
`.env`; el compose resuelve `…:dev-arm64` y `…:<sha>-arm64`; las imágenes
base tienen arm64. **Sin probar**: runner ARM, VM real y workflow en GitHub.

**Toca**: `.github/workflows/deploy-oracle.yml` (nuevo),
`infra/oracle/cloud-init.yml` (nuevo), `infra/oracle/README.md` (nuevo),
`infra/README.md`, `docs/decisiones/DECISIONES-CERRADAS.md`.
