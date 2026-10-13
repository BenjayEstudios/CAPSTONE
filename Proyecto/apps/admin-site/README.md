# apps/admin-site

Frontend Angular. Interfaz de **administración del sitio** (equipo interno
Cotizapp) — separada de `apps/ecommerce` porque sirve un rol distinto
(administrador) y no debe compartir build/deploy con el frontend de clientes.

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
pnpm dev     # ng serve, puerto 4300 por defecto, apunta a apps/backend en :8000
pnpm build
pnpm test
```

Puerto 4300 (distinto del 4200 de `apps/ecommerce`) para poder correr ambos
frontends en paralelo con `pnpm dev` desde la raíz.

## Dónde va cada cosa

- Tipos/DTOs compartidos con el backend → idealmente reutilizar
  `@cotizapp/domain` (TypeScript puro, sin dependencias de servidor).
- Sesión del administrador → `core/state/session.state.ts` + guards en `core/`.
- Nada de lógica de negocio del backend acá — eso vive en `apps/backend` +
  `packages/application`.

## Estado actual

Scaffold mínimo, sin features implementadas. Ver `docs/ARCHITECTURE.md` en
la raíz del repo para el detalle de módulos previstos.
