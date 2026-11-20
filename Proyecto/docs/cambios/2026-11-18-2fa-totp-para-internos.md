# 2FA TOTP para usuarios internos

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-144

## Qué cambió

El segundo factor de los usuarios internos pasa de un código enviado por
correo (KAN-112) a **TOTP** (RFC 6238): el código lo genera una app
autenticadora del teléfono (Google Authenticator, Microsoft Authenticator,
Authy) a partir de un secreto compartido una vez mediante un QR.

**Base de datos.** Columna nueva `usuario.mfa_secreto varchar(255)` (NULL =
sin enrolar), en `DataBase/dbDiagram.sql`, el schema de Drizzle,
`DataBase/init/01-schema.sql` y la migración
`packages/infrastructure/migrations/0002_usuario_mfa_secreto.sql`. Guarda el
secreto **cifrado** con AES-256-GCM; nunca en claro.

**API** (todo en `/auth/admin/mfa*`):

| Ruta | Qué hace |
|---|---|
| `POST /auth/admin/login` y `POST /auth/login` | Si el interno exige 2FA: `{ mfaRequerido: true, enrolar, desafio }`, sin token |
| `POST /auth/admin/mfa` | Usuario enrolado: desafío + código de la app → sesión |
| `POST /auth/admin/mfa/enrolar` | Primer ingreso: desafío → `{ secreto, otpauthUrl, qrDataUrl, desafio }`; guarda el secreto cifrado con `mfa_estado = pendiente` |
| `POST /auth/admin/mfa/confirmar` | Desafío de confirmación + primer código → `mfa_estado = activo`, sesión |
| ~~`POST /auth/admin/mfa/reenviar`~~ | Eliminada: con TOTP no hay código que reenviar |

**Admin-site.** El login muestra, en el primer ingreso, las instrucciones,
el QR y la clave para ingresarla a mano (en grupos de 4); en los siguientes,
solo pide el código de la app. Se quitó "Reenviar código".

**Reinicio (teléfono perdido).** Un administrador cambia el `mfaEstado` del
usuario a `pendiente`; cualquier cambio de `mfa_estado` que no sea `activo`
borra el secreto (`DrizzleUsuarioAdminRepository.actualizar`).

## Por qué así

- **TOTP y no correo.** Es lo que pide KAN-144 y la
  [decisión cerrada](../decisiones/DECISIONES-CERRADAS.md). El código por
  correo depende del correo: quien lo tenga comprometido tiene también el
  segundo factor.
- **Sin librería de TOTP.** El algoritmo son unas 30 líneas con
  `node:crypto` (`apps/backend/src/lib/totp.ts`), verificadas con los
  vectores oficiales de la RFC. Solo se agregó `qrcode` para dibujar el QR.
- **El mismo QR hasta confirmar.** El secreto se guarda (cifrado, como
  `pendiente`) al mostrar el QR, y si el usuario sale y vuelve a entrar antes
  de confirmar recibe el mismo. La primera versión generaba uno nuevo en cada
  intento y lo llevaba solo dentro del desafío: al probarlo con un teléfono
  real, tras un primer intento fallido el QR cambiaba, la app se quedaba con
  el secreto anterior y ningún código calzaba. Un secreto `pendiente` no
  sirve para entrar: el login lo trata como "debe enrolarse".
- **`pendiente` = exigido sin enrolar.** Así ya lo creaba `POST /usuarios`
  con `mfa: "activo"`; antes ese estado no pedía nada en el login.
- **Clave de cifrado.** `MFA_CLAVE_CIFRADO` si existe; si no, derivada de
  `JWT_SECRET`, para no obligar a nadie a tocar su `.env`. Cambiar la clave
  obliga a re-enrolar.
- **Códigos de un solo uso.** Un código aceptado no vuelve a servir en su
  ventana de 30 s (control en memoria del proceso, igual que los intentos).

## Corrección en admin-site encontrada al probar

El formulario del código era `<form (ngSubmit)>` sin `[formGroup]`: con solo
`ReactiveFormsModule`, Angular no le pone directiva, `ngSubmit` nunca se
emite y el navegador recargaba la página. El paso del código no funcionaba
en el navegador (tampoco con el correo); los tests llamaban a `verificar()`
directo y no lo veían. Ahora usa `[formGroup]="formMfa"` y hay un test que
envía el formulario desde el DOM.

## Pruebas

- `apps/backend/src/lib/totp.test.ts`: vectores de la RFC 6238, base32,
  ventana de ±30 s y cifrado (IV aleatorio, texto alterado rechazado).
- `apps/backend/src/routes/auth/mfa.test.ts`: enrolamiento y login
  siguiente de punta a punta, reuso de código, desafío manipulado, reenvío
  eliminado (404).
- `packages/application/src/use-cases/mfa-admin.use-case.test.ts`: qué
  estados exigen 2FA, bloqueo tras 5 fallos, tipos de desafío.
- `packages/infrastructure/test/cuenta.repository.test.ts`: guardar el
  secreto y reiniciarlo desde el admin, contra MySQL.
- Admin-site: QR en el primer ingreso y envío real del formulario.
- Probado en el navegador contra el MySQL local: enrolamiento, ingreso con
  código y código incorrecto.

## Pendiente

Aplicar la migración en Aiven (`pnpm db:migrate` con el `DATABASE_URL` de
Aiven). Hasta entonces, un backend con este código conectado a Aiven falla
al leer usuarios, porque la columna no existe.

## Toca

`DataBase/{dbDiagram.sql,init/01-schema.sql}`,
`packages/infrastructure/{migrations/0002_usuario_mfa_secreto.sql,migrations/meta/*,src/db/schema/usuario.schema.ts,src/repositories/{cuenta,usuario-admin}.repository.ts}`,
`packages/domain/src/{entities/usuario.entity.ts,dtos/auth.dto.ts,repositories/cuenta.repository.ts}`,
`packages/application/src/use-cases/{mfa-admin,login-admin,login,usuarios}.use-case(s).ts`,
`apps/backend/src/{lib/totp.ts,lib/mfa.ts,routes/auth/{mfa,login,login-admin,index}.ts}`,
`apps/backend/{package.json,.env.example}`,
`apps/admin-site/src/app/{core/auth/auth.service.ts,core/models/auth.models.ts,features/login/*}`.
