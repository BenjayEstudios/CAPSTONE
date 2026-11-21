# Pruebas end-to-end del flujo de compra

**Fecha:** 2026-11-20 · **Épica:** KAN-88 · **Ticket:** KAN-164

## Qué cambió

| Criterio | Cómo |
|---|---|
| Colección Postman del flujo: registro → buscar → comparar → carro multiproveedor → checkout → pago sandbox → envíos por proveedor | `docs/desarrollo/postman/flujo-compra.postman_collection.json`: 14 requests con 15 asserts. Registra un comprador nuevo y entra; busca y compara las ofertas de un producto; arma el carro con las dos más baratas de proveedores distintos; revisa las opciones de entrega y confirma; inicia el pago y vuelve de la pasarela. Después comprueba que la orden quedó pagada con un envío por proveedor (cada uno con sus líneas y su monto). Cierra con el proveedor del primer envío: ve solo su tramo y lo pasa a preparación, y el comprador ve la orden en preparación. Los IDs no están fijos: salen de las respuestas |
| Tests Jest de los casos de uso de application | El proyecto usa **Vitest**, que tiene la misma API que Jest (`describe`/`it`/`expect`, mocks) y corre TypeScript sin configuración extra. `packages/application` tiene 277 tests de casos de uso con repositorios en memoria |
| Se corren en el CI | Los de Vitest ya corrían en el job Node. Nuevo job **E2E** en `.github/workflows/ci.yml`: MySQL 8.4 limpio, migraciones y seed, backend con `PASARELA=simulada` y `pnpm e2e` (Newman). Si falla, muestra el log del backend |

### Pasarela simulada

Webpay real pide la tarjeta en la página de Transbank, que una prueba
automática no puede llenar. Nueva `PasarelaSimulada` en
`packages/infrastructure`, que el backend usa con `PASARELA=simulada`:

- Aprueba el pago que ella inició, por su monto, una sola vez.
- Su "página de pago" es el retorno del backend. Así el ecommerce, al enviar
  `token_ws` a `urlPago`, vuelve directo con el pago aprobado, y sirve
  también para demos sin Transbank.
- Un token que no inició, o de antes de reiniciar el backend, se rechaza.
- `env.ts` no deja arrancar el servidor con `simulada` si `NODE_ENV=production`
  o `WEBPAY_ENTORNO=produccion`.

## Por qué así

- **Postman y Newman**: el ticket pide una colección Postman. Newman la corre
  igual en el CI y en local (`pnpm e2e`), y la misma colección se puede
  importar y correr a mano en Postman.
- **Datos generados en cada corrida** (correo único, RUT válido al azar): la
  colección se repite sobre la misma base sin limpiar, y no depende de IDs
  fijos.
- **Base limpia en el CI**: cada corrida migra y siembra un MySQL nuevo, así
  que la prueba no depende de lo que haya dejado otra.
- **Generada por un script** (`generar-flujo-compra.mjs`), igual que la
  colección general: cambiar un paso es editar código legible, no un JSON
  largo.
- **Vitest y no Jest**: ya era la herramienta de todos los paquetes, con la
  misma API. Cambiar a Jest no agrega cobertura.

## Pruebas

- Local, contra una base limpia (`cotizapp_e2e`, migrada y sembrada, después
  borrada) y un backend en el puerto 8001 con `PASARELA=simulada`: dos
  corridas seguidas, 14 requests y 15 asserts sin fallos. La base de
  desarrollo no se tocó.
- `PasarelaSimulada` (`packages/infrastructure/test/pasarela-simulada.test.ts`):
  aprueba una vez por el monto y rechaza un token desconocido.
- `env.test.ts` del backend: `PASARELA` es webpay por defecto, `simulada` se
  rechaza en producción, y el selector arma la pasarela correcta.

## Archivos

- `packages/infrastructure/src/pagos/pasarela-simulada.ts`, `src/index.ts`, `test/pasarela-simulada.test.ts`.
- `apps/backend/src/config/env.ts` (`PASARELA`), `env.test.ts`, `src/lib/pasarela.ts`, `.env.example`, `README.md`.
- `docs/desarrollo/postman/flujo-compra.postman_collection.json`, `generar-flujo-compra.mjs`, `README.md`.
- `package.json` (script `e2e`, `newman` en devDependencies), `pnpm-lock.yaml`.
- `.github/workflows/ci.yml` (job E2E), `infra/README.md`.
