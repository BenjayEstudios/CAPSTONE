# Ecommerce: registro e ingreso del comprador

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-97

Primera historia del ecommerce: hasta ahora `apps/ecommerce` solo tenía la
vista de status. Consume la API de KAN-144.

## Qué cambió

**Pantallas** (`src/app/features/cuenta/`):

| Ruta | Qué hace |
|---|---|
| `/ingresar` | Correo y contraseña. Vuelve a `returnUrl` (por ejemplo, el checkout que pidió sesión) |
| `/registro` | Cuenta de comprador: **Persona** (organización con su nombre y RUT) o **Empresa** (razón social, RUT de la empresa, nombre de fantasía, giro) |
| `/recuperar-clave` | Pide el enlace por correo; el mensaje es el mismo exista o no la cuenta |
| `/restablecer-clave?token=` | La página que abre el enlace del correo: contraseña nueva y vuelta a `/ingresar` |

**Sesión** (`src/app/core/`):

- `state/session.state.ts`: guarda el JWT **y** el usuario en `localStorage`
  (`cotizapp.ecommerce.sesion`), así la sesión sobrevive a recargar.
- `auth/auth.service.ts`: login (`POST /auth/login`), registro, recuperación;
  traduce los `code` del backend a textos para la persona. Rechaza cuentas
  internas sin guardar nada: entran por admin-site.
- `auth/guards.ts`: `sesionGuard` (sin sesión → `/ingresar?returnUrl=…`) y
  `invitadoGuard` (con sesión, `/ingresar` y `/registro` llevan al inicio).
  La primera ruta protegida de cada carga confirma el token con
  `GET /auth/me`.
- `auth/auth.interceptor.ts`: agrega `Authorization: Bearer`; un 401 fuera de
  las rutas públicas de `/auth` limpia la sesión y lleva a
  `/ingresar?motivo=expirada`.

**Shell y tema:** cabecera con la marca, el catálogo y el estado de la sesión
("Hola, Marta · La Marraqueta" / Salir). `styles.css` toma los tokens de
admin-site y de los mockups (cian, magenta, amarillo, Source Serif 4).

**Rutas provisorias:** `/` (KAN-89), `/catalogo` (KAN-90) y `/checkout`
(KAN-95) muestran una pantalla "en desarrollo", pero ya con la regla de
acceso del criterio: **el catálogo se ve sin cuenta y el checkout exige
sesión**. La vista de status pasó a `/estado`.

## Por qué así

- **Persona o Empresa** viene del checkout del mockup del cliente ("Persona" /
  "Empresa (factura)"). El backend lo modela con `empresa` opcional.
- **RUT y contraseña se validan en el navegador** con las mismas reglas que
  el backend (`shared/validacion/validadores.ts`) para avisar antes de enviar.
  Se copió la regla del RUT en vez de importar `@cotizapp/domain`, que
  arrastraría Zod al bundle.
- **El 401 del login no cierra la sesión.** En admin-site el interceptor
  trataba cualquier 401 como sesión vencida (también el del código 2FA mal
  escrito); acá se excluyen las rutas públicas de `/auth`.
- **Se guarda también el usuario**, no solo el token: la cabecera muestra el
  nombre apenas carga la página, y `GET /auth/me` refresca los permisos.

## Pruebas

- `core/auth/auth.spec.ts`: ingreso y persistencia tras recargar, rechazo de
  internos, traducción de errores, registro, recuperación, `/auth/me` una
  vez por carga, Bearer, 401, guards, `destinoSeguro`.
- `features/cuenta/cuenta.spec.ts`: validadores (RUT con K, clave),
  registro persona y empresa, formulario inválido, enlace sin token.
- `app.component.spec.ts`: cabecera con y sin sesión.
- En el navegador contra el backend local: el checkout manda a ingresar, se
  crea una cuenta de empresa y vuelve al checkout con sesión (en la base:
  organización `cliente` activa y usuario `comprador`); la sesión sigue al
  recargar; al salir el catálogo abre y el checkout no; recuperar contraseña
  con el enlace del correo, la clave vieja ya no entra y la nueva sí; sin
  scroll horizontal a 375 px.

## Toca

`apps/ecommerce/src/{styles.css,index.html}`,
`apps/ecommerce/src/app/{app.component.*,app.config.ts,app.routes.ts}`,
`apps/ecommerce/src/app/core/{api,auth,models,state,testing}/*`,
`apps/ecommerce/src/app/features/{cuenta,pendiente}/*`,
`apps/ecommerce/src/app/shared/validacion/validadores.ts`,
`apps/ecommerce/README.md`.
