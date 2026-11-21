# Login único, registro de comprador/proveedor y recuperación de clave

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-144 (desbloquea
KAN-97 y KAN-100)

## Qué cambió

Endpoints públicos nuevos en `apps/backend/src/routes/auth/`:

| Método y ruta | Respuesta | Qué hace |
|---|---|---|
| `POST /auth/login` | `200 { token, usuario }` | Login único de ecommerce, mobile y admin-site, con la forma de [`API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md): `usuario.organizacion = { id, nombre, tipo }` |
| `POST /auth/registro/comprador` | `201 { token, usuario }` | Crea organización `cliente` (activa) + usuario `comprador` y deja la sesión iniciada |
| `POST /auth/registro/proveedor` | `201 { organizacionId, estado: "en_revision", mensaje }` | Crea organización `proveedor` en revisión + usuario `proveedor`; sin sesión hasta que un admin lo apruebe |
| `POST /auth/recuperar` | `202 { ok: true }` | Envía el enlace de recuperación (misma respuesta exista o no el correo) |
| `POST /auth/restablecer` | `200 { ok: true }` | Token del enlace + clave nueva |

Errores: `401 CREDENCIALES_INVALIDAS` (mismo error si el correo no existe o
la clave no calza), `403 USUARIO_NO_ACTIVO` (usuario suspendido u
organización no activa, p. ej. proveedor en revisión), `409 EMAIL_EN_USO`,
`409 RUT_EN_USO`, `400 ENLACE_INVALIDO`, `400 VALIDACION`. Todas tienen
límite por IP (`lib/rate-limit.ts`).

Capas:

- `domain`: `dtos/cuenta.dto.ts` (schemas Zod, `normalizarRut` con dígito
  verificador módulo 11, regla de clave: 8–72 caracteres con letra y número)
  y el puerto `repositories/cuenta.repository.ts` (`crear`,
  `actualizarClave`). `UsuarioConContexto.organizacion` suma `nombre`
  (opcional).
- `application`: `login`, `registrarComprador`, `registrarProveedor`,
  `solicitarRecuperacionClave`, `restablecerClave`.
- `infrastructure`: `DrizzleCuentaRepository` (organización + usuario en una
  transacción) y `DrizzleUsuarioRepository` ahora trae el nombre de la
  organización (`nombre_fantasia` o `razon_social`).
- `apps/backend`: rutas, `lib/recuperacion.ts` y la variable
  `ECOMMERCE_URL` (base del enlace de recuperación; los internos reciben el
  de `ADMIN_SITE_URL`).

## Por qué así

- **Un solo login.** El contrato que ya consumía mobile pedía
  `POST /auth/login` sin filtrar por rol; cada app decide qué roles acepta.
  Los internos con 2FA exigido reciben `{ mfaRequerido, enrolar, desafio }`
  y siguen en las rutas `/auth/admin/mfa*` (ver la entrada del 2FA TOTP).
  `/auth/admin/login` se mantiene para no romper admin-site.
- **Usuario `invitado` puede entrar.** El contrato decía que `invitado`
  respondía 403, pero los usuarios creados por invitación (`POST
  /usuarios`) son `invitado` hasta su primer ingreso. Se rechaza solo
  `suspendido`; el ejemplo del contrato (`contacto@laspalmas.test`) sigue
  dando 403 porque su organización está en revisión.
- **Recuperación sin tabla de tokens.** El enlace es un JWT de 30 minutos
  con una huella (HMAC) del `hash_clave` vigente: al cambiar la clave la
  huella deja de calzar, así que el enlace es de un solo uso sin agregar
  columnas ni tablas.
- **Proveedor sin sesión al registrarse.** Queda `en_revision` y el login
  responde `USUARIO_NO_ACTIVO` hasta `POST /proveedores/:id/aprobar`.
- **Permisos desde `rol.permisos`.** Ya estaba resuelto: todas las rutas
  usan `requirePermiso`, que lee la matriz desde la base en cada request;
  no queda ningún uso de `requireRol`.

## El resto de KAN-144

El 2FA TOTP para internos va en su propia entrada:
[2FA TOTP para usuarios internos](2026-11-18-2fa-totp-para-internos.md).

## Correcciones encontradas al probar contra Aiven

- **El backend no arrancaba con el `.env` de ejemplo.** Las variables vacías
  (`SMTP_HOST=`, `SMTP_USER=`...) fallaban la validación de `env.ts` en vez
  de contar como no definidas. `loadEnv` ahora descarta los strings vacíos
  (`apps/backend/src/config/env.ts`, test en `env.test.ts`).
- **`ECONNRESET` después de un rato sin uso.** Aiven corta las conexiones
  ociosas y el pool de `mysql2` entregaba una muerta: la primera query
  fallaba con 500. `createDbClient` activa keepalive y descarta las
  conexiones ociosas al minuto (`packages/infrastructure/src/db/client.ts`).
- **Un 500 devolvía la query SQL al cliente.** Drizzle mete la query completa
  en `error.message` y el error handler la reenviaba. Ahora los errores no
  previstos responden `500 INTERNAL_ERROR` con un mensaje genérico y el
  detalle queda solo en el log (`apps/backend/src/lib/error-handler.ts`).

## Pruebas

- `packages/application/src/use-cases/cuenta.use-cases.test.ts` (17 casos).
- `apps/backend/src/routes/auth/cuenta.test.ts` (rutas con repositorios en
  memoria, incluye el enlace de un solo uso).
- `packages/infrastructure/test/cuenta.repository.test.ts` (contra MySQL;
  borra lo que crea, porque la transacción propia del repositorio confirma
  la del arnés de tests).

## Toca

`packages/domain/src/{dtos/cuenta.dto.ts,repositories/cuenta.repository.ts,repositories/usuario.repository.ts,dtos/index.ts,repositories/index.ts}`,
`packages/application/src/use-cases/{login.use-case.ts,registro.use-cases.ts,recuperacion-clave.use-case.ts,index.ts}`,
`packages/infrastructure/src/repositories/{cuenta.repository.ts,usuario.repository.ts,index.ts}`,
`apps/backend/src/{routes/auth/*,lib/recuperacion.ts,config/env.ts,server/app.ts,types/fastify.d.ts}`,
`apps/backend/.env.example`.
