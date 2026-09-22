# @cotizapp/shared-config

Configuración compartida de TypeScript y ESLint para los paquetes/apps
Node.js del monorepo (`apps/rest`, `packages/*`), para no duplicarla ni
desincronizarla entre proyectos.

`apps/web` (Angular) y `apps/mobile` (Flutter) usan sus propias herramientas
de build/lint (Angular CLI / `flutter analyze`) y no dependen de este paquete.

## Estructura

```
typescript/
└── base.json   # tsconfig base (Node, strict, composite)

eslint/
└── base.js      # config flat de ESLint (JS/TS)
```

## Uso

```json
// tsconfig.json de un paquete
{ "extends": "@cotizapp/shared-config/typescript/base" }
```

```js
// eslint.config.js de una app/paquete Node
import baseConfig from "@cotizapp/shared-config/eslint/base";
export default [...baseConfig];
```
