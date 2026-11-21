# Arquitectura — Cotizapp

Describe el patrón general del monorepo: capas, reglas de dependencia y
decisiones de diseño transversales. La evolución concreta del proyecto en el
tiempo vive en [../cambios/](../cambios/README.md); no se mezclan.

Cotizapp es un ecommerce centralizado de cotización y compra multiproveedor
para pymes y emprendedores del rubro alimenticio: comparar precio, plazo de
entrega y calificación entre distribuidores, armar un carro multiproveedor y
pagar todo en una sola transacción. El contexto de producto completo está en
la documentación de `Fase1/` (Proyecto de Título, Duoc UC).

La estructura sigue la plantilla `Estructura-projects` (monorepo pnpm +
Turborepo, Clean Architecture), adaptada al stack de Cotizapp:
**Angular + Fastify + MySQL + Flutter + Digital Ocean**.

## Monorepo

- Gestor: **pnpm workspaces** + **Turborepo** (cache/orquestación de `build`,
  `dev`, `lint`, `check-types`, `test`).
- `apps/mobile` (Flutter) queda fuera de `pnpm-workspace.yaml` porque usa su
  propio gestor de paquetes (`pub`), pero convive en el mismo repo por
  conveniencia de contexto compartido.
- El repo tiene dos raíces: `Fase1/` (entregables del ramo, no se modifica) y
  `Proyecto/` (el monorepo). Los workflows de GitHub viven en la raíz del repo
  y corren con `working-directory: Proyecto`.

## Capas (clean architecture)

```
domain          →  entidades, DTOs, interfaces de repositorio (puro TypeScript, sin infraestructura)
application     →  casos de uso; reciben sus dependencias (repos, servicios) por parámetro/constructor
infrastructure  →  implementación real de las interfaces de domain/ (Drizzle + MySQL)
apps/backend    →  capa de interfaz HTTP; las rutas de Fastify arman las dependencias
                    (composition root) y llaman a los casos de uso de application/
```

Regla de dependencia: `apps/backend` → `application` → `domain` ← `infrastructure`.
`infrastructure` depende de `domain` (implementa sus interfaces) pero `domain`
nunca depende de `infrastructure` ni de Drizzle/MySQL directamente.

`apps/ecommerce` y `apps/admin-site` pueden importar `@cotizapp/domain`
(tipos/DTOs) sin arrastrar dependencias de servidor, ya que ese paquete es
TypeScript puro.

## Backend (`apps/backend`)

- Fastify + TypeScript, puerto **8000** en todos los ambientes.
  `src/server/app.ts` expone `buildApp()`: arma la instancia (plugins, manejo
  de errores) y actúa como **composition root** — conecta Drizzle una sola
  vez (`app.decorate("db", db)`) y registra las rutas. Cada ruta arma su
  repositorio con `request.server.db` y lo pasa al caso de uso.
- Sin service-locator ni contenedor de DI: todo se conecta explícitamente,
  sin variables globales ni módulos con estado compartido.
- **Rutas**: cada módulo (`auth`, `catalogo`, `pedidos`, `pagos`) vive en
  `src/routes/<modulo>/`, un archivo por operación que exporta un
  `RouteOptions` (`list.ts`, `create.ts`), agrupados en un `index.ts`
  (`<modulo>Routes: RouteOptions[]`). `src/routes/index.ts` los registra con
  un loop. Recorrido paso a paso en el
  [README](../../README.md#convención-de-rutas-http).
- **Seguridad**: autenticación/autorización con `preHandler` por ruta
  (`requireAuth`, `requireRol(...)` en `src/plugins/auth.ts`), nunca un hook
  global con lista de excepciones. Ni `domain` ni `application` conocen el
  JWT. Detalle en el
  [README](../../README.md#autenticación-y-autorización-en-las-rutas).
- **Configuración**: `src/config/env.ts` valida todo con Zod al arrancar
  (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` como lista separada por coma).
  Lo que falta falla al arrancar, no a mitad de un request.
- **Errores**: formato único `{ "error": { "code", "message" } }`, que es lo
  que interpreta `apps/mobile`.

Endpoints que existen hoy: `GET /health-check`, `GET /categorias`,
`POST /categorias` (protegido). Lo que los frontends necesitan y todavía no
existe está especificado en
[`apps/mobile/API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md).

## Ecommerce (`apps/ecommerce`)

- Angular 18 + TypeScript, puerto 4200. Una sola app para **clientes/pymes**
  y **proveedores**, con rutas y guards por rol (no dos apps): comparten
  sesión, catálogo y componentes base.
- Feature-based: `src/app/features/<feature>/` (`catalogo`, `comparador`,
  `carrito`, `checkout`, `panel-distribuidor`…); `src/app/core/` para lo
  transversal (cliente HTTP, interceptors, estado de sesión, guards).
- En producción usa `apiUrl: "/api"` (mismo origen detrás de Nginx, sin CORS).
- Hoy solo tiene la vista de status contra `/health-check`.

## Admin-site (`apps/admin-site`)

- Angular 18, puerto 4300, misma convención que `apps/ecommerce`. Interfaz de
  **administración del sitio** (equipo interno), separada porque sirve a otro
  rol y no debe compartir build/deploy con el frontend de clientes.
- Módulos previstos: usuarios/organizaciones, moderación
  (`moderacion_caso`), catálogo maestro, órdenes, liquidaciones y auditoría
  (`auditoria_log`). Hoy solo tiene la vista de status.

## Mobile (`apps/mobile`)

- Flutter, para **los dos perfiles** del marketplace (épica KAN-87):
  comprador (catálogo, comparador, carro, checkout, pedidos) y distribuidor
  (estadísticas, órdenes, reseñas, alertas). Los roles internos se rechazan:
  usan `admin-site`.
- Clean Architecture por feature: `lib/features/<feature>/{data,domain,presentation}`.
  `lib/core/` para lo transversal (config, red, router, tema, formatos,
  widgets, errores).
- Riverpod para DI y estado, go_router (redirect según rol), Dio,
  `flutter_secure_storage` para la sesión, `intl` para formatos es-CL.
- **Fakes**: con `USE_FAKES=true` (default) cada datasource devuelve el JSON
  exacto de `API_CONTRACT.md`, armado con una copia del seed
  (`lib/core/fake/seed.dart`). Pasar a la API real es cambiar el flag, sin
  tocar pantallas.
- Features hoy: `conexion` (diagnóstico), `auth`, `catalogo`.

## Pagos

Consumida solo desde `apps/backend` detrás del puerto `PasarelaPago`
(`packages/domain/src/services`), con un adaptador por pasarela en
`packages/infrastructure/src/pagos` y selector `PASARELA` en
`apps/backend/src/lib/pasarela.ts`:

- `paypal` — `PayPal` (Orders API v2, sandbox). Es la que se usa mientras no
  exista cuenta empresa de Webpay. PayPal no acepta CLP: se cobra en USD con
  `PAYPAL_CLP_POR_USD`; el monto en pesos viaja en `custom_id` y es el que se
  compara con el total de la orden. El navegador va a la URL de aprobación con
  un GET (`metodo: "GET"` en la respuesta de `POST /ordenes/:id/pago`) y vuelve
  a `GET /pagos/paypal/retorno`.
- `webpay` — `WebpayPlus` de Transbank (API REST v1.2), formulario POST con
  `token_ws` y retorno a `/pagos/webpay/retorno`.
- `simulada` — aprueba sin pasarela (pruebas e2e; no en producción).

Los datos de tarjeta se ingresan en la pasarela: nunca tocan el backend
propio. Flujo (KAN-95), descrito para Webpay (con PayPal cambia solo el paso
de ida y la URL de retorno, que se traduce a la misma forma):

1. `POST /carro/confirmar` crea la orden `pendiente_pago` (un envío por
   distribuidor) y descuenta stock.
2. `POST /ordenes/:id/pago` crea la transacción por el total y guarda el
   token en `orden.referencia_pasarela`; el navegador envía `token_ws` a
   Webpay con un formulario POST.
3. Webpay devuelve al comprador a `GET|POST /pagos/webpay/retorno` (público),
   que confirma (commit), deja la orden `pagada` / `pagado` o `fallido`,
   emite la boleta o factura y las guías (`emitirDocumentosOrden`) y redirige
   a `ECOMMERCE_URL/checkout/resultado`.

Ambiente por `WEBPAY_ENTORNO` (`integracion` usa las credenciales públicas
de prueba) o `PAYPAL_ENTORNO` (`sandbox`). El reparto (split) entre distribuidores es simulado en la base
propia — no hay split nativo de la pasarela — y se refleja en `liquidacion`.
La devolución por pasarela de un reembolso queda como punto de extensión
(`devolverDinero` en `reembolsos.use-cases.ts`, KAN-148).

## Infraestructura

Un solo droplet de Digital Ocean, todo en contenedores
(`infra/docker-compose.prod.yml`):

- **nginx**: imagen propia que compila `apps/ecommerce` y lo sirve como SPA;
  `/api/*` va al backend por la red interna.
- **backend**: imagen multi-stage, Node 22, solo deps de producción, usuario
  `node`.
- **mysql** 8.4 con volumen `cotizapp-mysql-data`; no publica puertos.

Solo Nginx expone puertos. Toda la config productiva va en un único
`infra/.env`. El desarrollo usa `docker-compose.yml` (raíz de `Proyecto/`) con
bind mounts y hot-reload, y la base compartida de desarrollo está en Aiven.
CI con GitHub Actions (`ci.yml`); el deploy (`deploy-dev.yml`) existe pero
está apagado. Detalle y comandos en [infra/README.md](../../infra/README.md).

## Ejemplo de referencia: `categoria`

Caso de uso completo de punta a punta —listar y crear categorías
(`GET/POST /categorias`, la segunda con `requireAuth` +
`requireRol(...)`)— recorriendo las 4 capas:
`packages/domain/src/{entities,dtos,repositories}/categoria.*`,
`packages/application/src/use-cases/{listar,crear}-categoria.use-case.ts`,
`packages/infrastructure/src/{db/schema,repositories}/categoria.*` y
`apps/backend/src/routes/categorias/{list,create,index}.ts`. Recorrido paso a
paso en el
[README](../../README.md#cómo-agregar-una-funcionalidad-nueva-ejemplo-de-referencia-categoria);
es la plantilla para `producto`, `oferta`, `carro`…

El modelo de datos tiene su propio archivo:
[MODELO-DE-DATOS.md](MODELO-DE-DATOS.md).
