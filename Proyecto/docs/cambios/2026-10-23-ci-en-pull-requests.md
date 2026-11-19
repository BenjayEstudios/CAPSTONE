# CI de tests en cada PR con GitHub Actions

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-161 (primera parte)

`.github/workflows/ci.yml` en la **raíz** del repo (GitHub solo busca
workflows ahí), con `working-directory: Proyecto`. Corre en cada PR a
`main`/`dev` y en push a `dev-*`; un push nuevo cancela la corrida anterior.

- **Job Node**: pnpm de `packageManager`, Node 22, caché de pnpm y Turborepo,
  `turbo run check-types lint test build`.
- **Job Flutter**: solo si cambia `apps/mobile` (o el propio `ci.yml`):
  `pub get`, `analyze`, `test`. Si no corre queda *skipped*, que GitHub
  cuenta como éxito.

`deploy-dev.yml` queda escrito pero **apagado** hasta crear la variable
`DEPLOY_ENABLED=true`; los secrets que necesita están en
[infra/README.md](../../infra/README.md#cicd-github-actions).

**Por qué**: tener CI en los PRs desde ya, antes de que entre más código.

**Ojo — quedó a medias en el commit**: el job Node corre `ng lint` y
`ng test` en `ecommerce` y `admin-site`, pero lo que esas apps necesitan para
eso (target `lint` en `angular.json`, `eslint.config.mjs`, specs mínimos de
`AppComponent` y `StatusComponent`, devDependencies de angular-eslint y
karma) **no entró en el commit `a4f3e20`** y sigue sin commitear. Hasta
commitearlo, el job Node no puede pasar en `main`. Ver
[la entrada siguiente](2026-10-23-ci-tests-angular-en-chromeheadless.md).

**Toca**: `.github/workflows/{ci,deploy-dev}.yml` (nuevos).
