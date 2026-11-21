# Panel del proveedor: documentos

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-110

## Qué cambió

Nueva pestaña **"Documentos"** en el panel del proveedor
(`/proveedor/documentos`): una tarjeta por documento exigido, con su estado y
un formulario para subir uno nuevo.

| Criterio | Cómo |
|---|---|
| Subir carpeta tributaria, resolución sanitaria y certificado de vigencia | "Subir documento" (o "Subir nueva versión") abre el formulario: archivo PDF, JPG o PNG de hasta 5 MB, y fecha de vencimiento. El formato se revisa por la firma binaria del archivo, no por su nombre. El servidor le pone el nombre y lo guarda con `AlmacenArchivos` en `proveedores/{id}/documentos/{tipo}-{uuid}.{ext}` |
| Muestra el estado al día / por vencer / vencido con la fecha de vencimiento | Cada tarjeta muestra "Al día", "Vence en 18 días", "Vencido" o "Falta", con la fecha ("Vence el 28 de diciembre de 2026") y un enlace al archivo. La vigencia se calcula al consultar, con la misma regla de 45 días que las alertas del panel (KAN-101). Vale el último documento subido de cada tipo; si hay versiones anteriores, se cuentan |
| Al subir un documento queda pendiente de revisión del administrador | Se inserta con `revision_estado = pendiente`. La tarjeta dice "Pendiente de revisión del equipo de Cotizapp" (o "Aprobado", o "Rechazado: motivo. Sube uno nuevo.") y el aviso lo confirma. El admin lo ve en el detalle del proveedor y lo revisa con el endpoint que ya existía |

### API

- `GET /proveedor/documentos` y `POST /proveedor/documentos?tipo=&venceEn=`
  (multipart; nuevos). Ver "Documentos del proveedor" en el README del
  backend.

## Por qué así

- **Tipo y vencimiento en la query, el archivo en el cuerpo**: con
  `@fastify/multipart`, los campos de formulario que vienen después del
  archivo no se leen antes de procesarlo; la query no depende del orden.
- **La carpeta tributaria no exige vencimiento**: es la situación tributaria a
  una fecha y no vence como la resolución sanitaria o el certificado de
  vigencia (supuesto del equipo). La fecha es opcional para ella y
  obligatoria para los otros dos.
- **No se acepta un documento ya vencido** (`400 DOCUMENTO_VENCIDO`): no
  sirve de nada y ensucia la revisión.
- **No se borran las versiones anteriores**: el admin puede ver qué se subió
  antes y la auditoría guarda la clave de cada archivo.
- **Sin caso de moderación**: `moderacion_caso.tipo` no tiene un tipo para
  documentos y agregarlo requiere migración. Lo pendiente queda en
  `revision_estado`, que el admin ya ve en el listado de proveedores
  (conteo de pendientes) y en el detalle.
- **Si falla el registro, se borra el archivo**, para no dejar archivos
  huérfanos en el almacén.
- **Los archivos se sirven por URL pública**, como las imágenes. Para
  documentos tributarios conviene que sea privada:
  [decisión abierta #19](../decisiones/DECISIONES-ABIERTAS.md).

## Pruebas

- Application (`documentos-proveedor.use-cases.test.ts`, nuevo):
  - Un documento por tipo: el último subido, con su vigencia de hoy y su revisión, las versiones anteriores contadas, y "falta" si no hay.
  - Sube un PDF con nombre del servidor, pendiente de revisión y con auditoría.
  - La carpeta no exige vencimiento y acepta PNG.
  - Rechaza sin vencimiento, ya vencido, vacío, muy grande (413), otro formato y sin proveedor.
  - Si falla el registro, borra el archivo.
  - Detecta el formato por firma binaria.
- Infrastructure (`proveedor.repository.test.ts`): `crearDocumento` queda pendiente con vigencia y auditoría, y `listarDocumentos` lo trae.
- Backend (`routes/panel-proveedor/documentos.test.ts`, nuevo, con multipart real): 401 y 403, los tres documentos con su estado, subida 201 con nombre del servidor, y 400 sin archivo, sin vencimiento, vencido, formato raro o tipo desconocido.
- Ecommerce (`features/proveedor/documentos.spec.ts`):
  - Estados, fechas, revisión y versiones.
  - Subida con `FormData`, el aviso y la recarga.
  - Validación antes de enviar, y el error del backend en su tarjeta.
  - Textos.
- En el navegador (Chrome) como Los Andes:
  - Se subió un PDF como certificado de vigencia con vencimiento el 28 de diciembre. La tarjeta pasó de "Falta" a "Vence en 37 días" y "Pendiente de revisión".
  - El archivo se sirve como `application/pdf`, y el admin lo ve pendiente en `GET /proveedores/2`.
  - Después se borraron el documento, su auditoría y el archivo.

## Archivos

- `packages/domain/src/dtos/proveedor.dto.ts` (`subirDocumentoQuerySchema`), `repositories/proveedor.repository.ts` (`crearDocumento`).
- `packages/application/src/use-cases/documentos-proveedor.use-cases.ts` y su test.
- `packages/infrastructure/src/repositories/proveedor.repository.ts`; `test/proveedor.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts`, `routes/panel-proveedor/documentos.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/documentos.component.*`, `documentos.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/panel-proveedor.service.ts`, `app.routes.ts`.
- `docs/decisiones/DECISIONES-ABIERTAS.md` (#19).
