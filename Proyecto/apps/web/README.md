# apps/web

Frontend Angular. Una sola app para **clientes/pymes** y **distribuidores**
— ambos roles autenticados comparten sesión, catálogo y componentes de UI
base; lo que cambia es el set de rutas disponible según rol.

## Estructura

```
src/
├── app/
│   ├── app.config.ts     # providers raíz (router, HttpClient, etc.)
│   ├── app.routes.ts       # rutas raíz — cada feature se registra acá (lazy)
│   ├── app.component.*      # shell de la app
│   ├── core/                 # transversal: cliente API, estado de sesión,
│   │                           guards de rol, interceptors de auth
│   ├── features/               # una carpeta por feature de negocio
│   └── shared/                   # componentes/pipes de UI reutilizables
└── environments/                   # environment.ts (prod) / environment.development.ts
```

## Cómo correrlo

Requiere Angular CLI instalado globalmente (`pnpm add -g @angular/cli`) o
usar `pnpm dlx ng` como alternativa.

```bash
pnpm install
pnpm dev     # ng serve, puerto 4200 por defecto, apunta a apps/rest en :3000
pnpm build
pnpm test
```

## Dónde va cada cosa

- Tipos/DTOs compartidos con el backend → idealmente reutilizar
  `@cotizapp/domain` (TypeScript puro, sin dependencias de servidor).
- Autenticación/rol activo → `core/state/session.state.ts` + guards en `core/`.
- Nada de lógica de negocio del backend acá — eso vive en `apps/rest` +
  `packages/application`.
