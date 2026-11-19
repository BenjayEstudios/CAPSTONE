# CI: lint y tests de Angular, y un solo paso de turbo

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-161

Completa lo que el [CI en PRs](2026-10-23-ci-en-pull-requests.md) daba por
hecho para `ecommerce` y `admin-site`:

- **Lint**: angular-eslint, con `eslint.config.mjs` y target `lint` en
  `angular.json`.
- **Tests**: karma + jasmine, con specs mínimos de `AppComponent` y
  `StatusComponent` (backend OK / backend caído).
- El script `test` pasa a ser `ng test --watch=false --browsers=ChromeHeadless`,
  así corre igual en local y en el runner (requiere Chrome o Chromium; si no
  está en el PATH, exportar `CHROME_BIN`).

Con eso, `ci.yml` deja de tener tres pasos (turbo sin test → vitest
filtrando Angular → `ng test` con el flag agregado a mano) y queda en uno:
`turbo run check-types lint test build --continue`.

**Por qué**: el paso aparte existía solo para agregar `--browsers=ChromeHeadless`;
con el flag en el script de cada app sobra, y local y CI corren exactamente
lo mismo.

**Ojo**: cambió el lockfile — correr `pnpm install` en local.

**Toca**: `.github/workflows/ci.yml`,
`apps/{ecommerce,admin-site}/{package.json,angular.json,eslint.config.mjs}`,
`apps/{ecommerce,admin-site}/src/app/**/*.spec.ts` (nuevos), `pnpm-lock.yaml`,
`infra/README.md`.
