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

## Catálogo y búsqueda (KAN-90, KAN-91)

`features/catalogo/`: `/catalogo` (filtros por categoría, plazo y mínimo; tarjetas o tabla; orden por precio) y `/buscar?q=` (refinar por 24 h, sin mínimo, retiro y marca; más barato y diferencia con el más caro). Los filtros viven en la URL. Cada término nuevo se registra con `core/analitica/analitica.service.ts` (`POST /eventos/lote`, evento `busqueda` con `resultados`).

## Ficha de producto y comparador (KAN-92, KAN-93)

`features/producto/`: `/producto/:id` con el precio más bajo hoy, la diferencia entre el más barato y el más caro, y el comparador en **tabla** (todos los distribuidores por precio unitario) o **lado a lado** (`?vista=lado`, los 3 más baratos). Comprar agrega la oferta al carro con `CarroState.agregar` (`PUT /carro` con lo que ya había más la oferta; las cajas cumplen el mínimo de compra). Registra `vista_producto` (con `?origen=catalogo|busqueda`, si no `directo`) y `click_oferta`.

## Carro (KAN-94)

`features/carro/`: `/carro` agrupado por distribuidor con plazo, subtotal y despacho; cantidades en cajas con +/– (respeta el mínimo y el stock), quitar, aviso de precios cambiados ("Aceptar los precios nuevos"), ofertas no disponibles, y resumen con despachos, ahorro vs. el más caro y total. `GET /carro` no trae distribuidor, plazo, mínimo ni despacho: salen de la ficha de cada producto. Los montos los calcula `carro.calculo.ts` (`armarCarro`, pura) con las mismas reglas que el checkout del backend. Los cambios pasan por `CarroState` (`PUT /carro` con el carro completo). `shared/compra.ts` tiene `cajasMinimas`, que usan la ficha y el carro.

## Checkout y pago (KAN-95)

`features/checkout/`: `/checkout` en tres pasos (boleta o factura; entrega por distribuidor, despacho o retiro en su bodega, con dirección guardada o nueva; tarjeta por Webpay) con "Así llega tu pedido" y el total. Pagar llama `POST /carro/confirmar` y `POST /ordenes/:id/pago` (`core/checkout/checkout.service.ts`) y `NavegadorPasarela` envía `token_ws` a Webpay con un formulario POST. Webpay vuelve al backend, que redirige a `/checkout/resultado?orden=&pago=`: lee la orden (no confía solo en `?pago=`) y, si sigue pendiente, ofrece "Reintentar el pago". `FichasDelCarro` (en `features/carro/`) carga las fichas que usan el carro y el checkout.

Para probar el pago en local usar `http://localhost:4200`: el ambiente de integración de Transbank rechaza (403) un formulario con origen `http://[::1]:4200`. Tarjeta de prueba de Transbank: 4051 8856 0044 6623, CVV 123; en el banco simulado, RUT 11.111.111-1 y clave 123. La vista de status está en `/estado`.

## Confirmación y detalle de la compra (KAN-96)

`features/pedidos/detalle-orden.component.ts`: detalle consolidado de una orden (folio, medio de pago, total, documentos; por distribuidor estado, despacho con dirección o retiro con el punto, plazo y fecha estimada, líneas y montos). Lo usa `/checkout/resultado` y sirve para "Mis pedidos" (KAN-98). Los PDF de `GET /documentos-tributarios/:id/pdf` piden el token: se descargan como blob (`ApiClient.getBlob`) y se abren en otra pestaña.

## Tests

`pnpm test` corre Karma en ChromeHeadless. Sin Chrome instalado sirve Edge: `CHROME_BIN="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" pnpm test`.

## Dónde va cada cosa

- Tipos/DTOs compartidos con el backend → idealmente reutilizar
  `@cotizapp/domain` (TypeScript puro, sin dependencias de servidor).
- Autenticación/rol activo → `core/state/session.state.ts` + guards en `core/`.
- Nada de lógica de negocio del backend acá — eso vive en `apps/backend` +
  `packages/application`.
