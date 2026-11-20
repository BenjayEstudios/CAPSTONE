# apps/ecommerce

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
pnpm dev     # ng serve en :4200, apunta a apps/backend en :8000 (environment.development.ts)
pnpm build
pnpm test
```

## Cuenta y sesión (KAN-97)

- Rutas: `/ingresar`, `/registro` (persona o empresa), `/recuperar-clave`, `/restablecer-clave?token=` (`features/cuenta/`).
- `core/state/session.state.ts` guarda JWT y usuario en `localStorage` (`cotizapp.ecommerce.sesion`).
- `core/auth/guards.ts`: `sesionGuard` para lo que exige cuenta (checkout, pedidos); el catálogo **no** lo usa. `invitadoGuard` para ingresar/registro.
- `core/auth/auth.interceptor.ts`: Bearer en cada llamada; 401 fuera de las rutas públicas de `/auth` -> `/ingresar?motivo=expirada`.
- Las cuentas internas no entran al ecommerce (usan admin-site).
- En desarrollo el correo de recuperación no se envía: con `MAIL_OUT_DIR` en el backend se escribe en esa carpeta y de ahí se copia el enlace.

## Inicio (KAN-89)

`features/inicio/`: buscador (en la cabecera), contadores, categorías con conteo y "Mayor diferencia de precio hoy". Datos de `GET /catalogo/resumen` y `GET /catalogo/productos?orden=diferencia` (`core/catalogo/catalogo.service.ts`). El carro de la cabecera sale de `core/state/carro.state.ts` (`GET /carro`, solo compradores).

Rutas provisorias hasta su historia: `/catalogo` (KAN-90/91), `/producto/:id` (KAN-92), `/carro` (KAN-94), `/checkout` (KAN-95). La vista de status está en `/estado`.

## Tests

`pnpm test` corre Karma en ChromeHeadless. Sin Chrome instalado sirve Edge: `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" pnpm test`.

## Dónde va cada cosa

- Tipos/DTOs compartidos con el backend → idealmente reutilizar
  `@cotizapp/domain` (TypeScript puro, sin dependencias de servidor).
- Autenticación/rol activo → `core/state/session.state.ts` + guards en `core/`.
- Nada de lógica de negocio del backend acá — eso vive en `apps/backend` +
  `packages/application`.
