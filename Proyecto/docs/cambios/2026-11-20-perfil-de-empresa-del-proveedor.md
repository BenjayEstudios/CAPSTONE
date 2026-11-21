# Panel del proveedor: perfil de empresa

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-108

## Qué cambió

Nueva pantalla **"Perfil de empresa"** (`/proveedor/perfil`). Se abre con el
botón del mismo nombre en el marco del panel, junto a "Asignarme un
producto", como en el mockup. Es un formulario con los datos de la ficha
pública y de los documentos tributarios, y al lado el estado de la cuenta.

| Criterio | Cómo |
|---|---|
| Datos legales, contacto comercial y de operaciones | **Razón social y RUT** se ven pero no se editan: salen en boletas y facturas y se validaron al aprobar la cuenta. Para cambiarlos hay que escribir a soporte. Se editan el nombre de fantasía y el giro. **Contacto comercial**: correo y teléfono. **Contacto de operaciones**: los usuarios activos de la empresa (nombre, correo y teléfono), solo lectura (ver decisión abierta #18) |
| Dirección comercial, bodega y horario de retiro | Dirección comercial (calle, número, oficina, comuna) y **bodega**: el punto de retiro principal, con su nombre, horario y dirección. Si no tiene bodega, se crea al guardarla. Las comunas van agrupadas por región. Los demás puntos de retiro y las zonas de despacho se administran en KAN-109 |
| Tiempos de despacho: plazo estándar, plazo fuera de región, hora de corte, despacho gratis desde | Los cuatro campos, con las regiones que despacha (de `proveedor_cobertura`, solo lectura) |
| Ofrece retiro / solo despacho; banco y cuenta de liquidación | Tres opciones: despacho y retiro, solo despacho o solo retiro. Además, banco y número de cuenta |
| Estado de la cuenta: verificada, comisión vigente, % de entregas a tiempo | Recuadro lateral con "Verificada", "En revisión" o "Suspendida", proveedor desde, entregas a tiempo, comisión vigente y el banco con la cuenta abreviada ("Banco de Chile · cta. …3-02") |

"Guardar cambios" manda solo lo que cambió; "Descartar" vuelve a lo guardado.
Antes de enviar, la pantalla revisa el nombre, el correo, el plazo, el formato
de la cuenta, que la dirección tenga calle y comuna, y que para ofrecer retiro
haya bodega.

### API

- `GET /proveedor/perfil` y `PATCH /proveedor/perfil` (nuevos): ver "Perfil de
  empresa" en el README del backend.

## Por qué así

- **Una dirección nueva no pisa la anterior.** En el seed la bodega y la
  dirección comercial comparten fila, y un retiro pasado cita el punto de
  retiro. Editar la fila en su lugar cambiaría las dos direcciones y la
  historia. El repositorio inserta otra fila de `direccion` y apunta a ella.
- **Razón social y RUT fijos**: son la identidad tributaria y se revisaron al
  aprobar al proveedor; cambiarlos sin revisión rompería esa validación.
- **Auditoría de cada cambio**, en la misma transacción. Se guarda solo lo que
  cambió y la cuenta bancaria va enmascarada (`…3-02`): el registro no debe
  guardar el número completo.
- **Reglas en el backend**: al menos una modalidad (`409 SIN_MODALIDAD`) y,
  para ofrecer retiro, una bodega (`409 RETIRO_SIN_BODEGA`). La pantalla
  repite las reglas para avisar antes de enviar.
- **Representante legal y contacto de operaciones dedicado**: no hay columnas
  y agregarlas requiere migración. Quedó como
  [decisión abierta #18](../decisiones/DECISIONES-ABIERTAS.md); mientras
  tanto, el contacto de operaciones son los usuarios de la empresa.

## Pruebas

- Application (`perfil-proveedor.use-cases.test.ts`):
  - Lee el perfil de la organización del token; si no es un proveedor, 403.
  - Guarda solo lo que cambió y lo audita con la cuenta enmascarada.
  - Sin cambios reales no escribe; la razón social y el RUT no se aceptan.
  - Las direcciones nuevas deben tener una comuna que exista.
  - Al menos una modalidad, y la bodega para ofrecer retiro.
  - Valida los formatos.
- Infrastructure (`proveedor.repository.test.ts`, nuevo):
  - El perfil de Los Andes completo; Valle Central no tiene bodega, y un cliente no tiene perfil.
  - Al actualizar se insertan direcciones nuevas sin tocar la anterior, y queda una fila de auditoría.
  - Si no hay bodega, guardarla crea el punto de retiro.
  - La base queda igual después de la suite.
- Backend (`routes/ordenes/ordenes.test.ts`): 401, 403 sin permiso de proveedor, GET, PATCH, 409 SIN_MODALIDAD y 400 al intentar cambiar el RUT.
- Ecommerce (`features/proveedor/perfil.spec.ts`):
  - Razón social y RUT de solo lectura, el equipo, las regiones y el estado de la cuenta, sin el número completo de la cuenta.
  - Se manda solo lo que cambió.
  - Un 409 se muestra con su mensaje.
  - `cambiosPerfil` y `problemasPerfil`.
- En el navegador (Chrome) como Los Andes:
  - Se cambió el horario de retiro, la hora de corte a 15:30 y la comuna de la bodega a Renca.
  - En la base, la organización siguió apuntando a la dirección 2 (Quilicura) y la bodega a una dirección nueva en Renca, con la fila de auditoría.
  - Después se restauraron los datos y se borraron la dirección y la auditoría de prueba.

## Archivos

- `packages/domain/src/dtos/proveedor.dto.ts` (`actualizarPerfilProveedorSchema`), `repositories/proveedor.repository.ts` (`PerfilProveedor`, `CambiosPerfilProveedor`, `perfil`, `actualizarPerfil`).
- `packages/application/src/use-cases/perfil-proveedor.use-cases.ts` y su test.
- `packages/infrastructure/src/repositories/proveedor.repository.ts`; `test/proveedor.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts` (`GET`/`PATCH /proveedor/perfil`), `routes/ordenes/ordenes.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/perfil.component.*`, `perfil.spec.ts`, `panel-proveedor.component.ts` (botón), `core/proveedor/panel-proveedor.service.ts`, `app.routes.ts`.
- `docs/decisiones/DECISIONES-ABIERTAS.md` (#18).
