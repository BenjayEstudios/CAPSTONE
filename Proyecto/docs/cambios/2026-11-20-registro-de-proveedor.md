# Registro y alta de proveedor ("Vender en Cotizapp")

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-100

## Qué cambió

Una distribuidora pide su alta desde el ecommerce en `/vender` ("Vender en
Cotizapp", enlazado en el pie de página y en "Ingresar"). Es la primera
pantalla del lado del proveedor.

| Criterio | Cómo |
|---|---|
| Captura los datos legales (razón social, RUT, giro, representante) y de contacto | Tres bloques: **datos legales de la empresa** (razón social, RUT, giro, nombre de fantasía y teléfono opcionales), **representante** (nombre y RUT; teléfono opcional) y **acceso y contacto** (correo y contraseña). El RUT se valida con dígito verificador y se formatea al salir del campo; el giro y el RUT del representante son obligatorios en la pantalla |
| La organización queda en `en_revision` y se crea un caso de moderación `alta_proveedor` | `POST /auth/registro/proveedor` (KAN-144) ya creaba la organización en revisión. Ahora además abre el caso `alta_proveedor` (entidad `organizacion`) con un resumen ("razón social (RUT) · giro · contacto"), usando `abrirCasoModeracion`, que lo audita y no duplica. Aparece en la cola de moderación del admin-site |
| El proveedor no puede publicar ofertas hasta estar activo | Ya lo garantizaba el backend: el login responde `USUARIO_NO_ACTIVO` mientras la organización no esté `activa`, y publicar ofertas exige `activa` (`PROVEEDOR_NO_ACTIVO`). La pantalla de éxito lo dice: "no podrás ingresar ni publicar ofertas" hasta la aprobación |

Al enviar se ve "Recibimos la solicitud de {empresa} · en revisión", con el
correo al que se avisará. No se inicia sesión.

## Por qué así

- **El caso se abre después de crear la cuenta, sin transacción común.** Si
  abrir el caso fallara, la solicitud ya existe y el proveedor sigue visible
  como `en_revision` en la lista de proveedores del admin; el error se
  registra en el log en vez de devolverle un 500 a quien ya quedó registrado
  (y que no podría reintentar porque su correo ya existe).
- **Giro y RUT del representante obligatorios en la pantalla** aunque el
  schema los acepte opcionales: los pide el criterio y no cambia el contrato
  que usa la app.
- **Aprobar no cierra el caso todavía**: `POST /proveedores/:id/aprobar`
  cambia el estado de la organización y el caso se cierra desde la cola de
  moderación. Unirlos queda como mejora para el admin.

## Pruebas

- Application (`cuenta.use-cases.test.ts`): el alta abre el caso `alta_proveedor` con su detalle y auditoría; si abrir el caso falla, la solicitud queda igual y se informa.
- Ecommerce (`features/cuenta/vender.spec.ts`): exige razón social, RUT de la empresa, giro, representante y su RUT (y distingue RUT vacío de dígito verificador malo); envía la solicitud con los RUT normalizados y muestra "en revisión" sin iniciar sesión; `RUT_EN_USO` se explica.
- En el navegador (Chrome) contra el backend local, con datos de prueba: validaciones, envío y pantalla de éxito; en la base, la organización en `en_revision`, su usuario, el caso `alta_proveedor` abierto con su auditoría, y el login respondiendo `USUARIO_NO_ACTIVO`. Después se borraron los datos de prueba.

## Archivos

- `packages/application/src/use-cases/registro.use-cases.ts` (`registrarProveedor` abre el caso), `apps/backend/src/routes/auth/registro.ts`.
- `apps/ecommerce/src/app/features/cuenta/vender.component.{ts,html}`, `vender.spec.ts`, `cuenta.css`.
- `apps/ecommerce/src/app/core/auth/auth.service.ts` (`registrarProveedor`), `core/models/auth.models.ts`, `app.routes.ts`, `app.component.html` (pie), `features/cuenta/ingresar.component.html`.
