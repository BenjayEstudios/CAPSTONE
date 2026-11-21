# Mobile: endpoints verificados contra la API real

**Fecha:** 2026-11-21 · **Épica:** KAN-87 · **Ticket:** KAN-201 (parcial)

## Qué se hizo

Se recorrieron contra el backend local (con los datos de `job:datos-de-prueba`)
todos los endpoints del índice de `apps/mobile/API_CONTRACT.md`, como
comprador (`qa-aromos@cotizapp.test`, login real) y como distribuidor (token
firmado para un usuario de la organización proveedora 2):

- `GET /health-check`, `/categorias`, `/catalogo/productos`,
  `/catalogo/productos/:id`, `/carro`, `/carro/opciones-entrega`, `/comunas`,
  `/ordenes`, `/ordenes/:id` (comprador) → 200.
- `GET /ordenes`, `/estadisticas/proveedor/ventas`, `/estadisticas/proveedor`,
  `/calificaciones/recibidas` (nueva, KAN-200), `/alertas/proveedor` y
  `PATCH /ordenes/envios/:id/estado` (distribuidor) → 200.
- `POST /eventos/lote` (anónimo) → 202. `POST /auth/login` → 200 con `token` y
  `usuario`.

Las claves de cada respuesta coinciden con el contrato. `POST /auth/login`
también acepta cuentas internas; la app las descarta porque
`Perfil.desdeRol` solo reconoce los roles de comprador y distribuidor.

## Qué se corrigió

El contrato tenía un aviso de "bloqueo principal" que decía que no existía
`POST /auth/login`; ya existe (KAN-144). Se reescribió, y la sección
"Pendiente" de `docs/epicas/EPICA-KAN-87-app-mobile.md` ahora separa lo
verificado de lo que falta.

## Qué NO se hizo (KAN-201 queda abierto)

No hay Flutter ni acceso al droplet de QA en este entorno, así que no se
corrió la app con `USE_FAKES=false`, no se probó contra QA y no se generó el
APK de release apuntando a QA. Los datasources remotos y el manejo de 401 ya
están en el código (`lib/core/network/api_client.dart`, `*_remote_datasource.dart`).
