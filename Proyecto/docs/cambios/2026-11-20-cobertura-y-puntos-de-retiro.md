# Panel del proveedor: cobertura de despacho y puntos de retiro

**Fecha:** 2026-11-20 · **Épica:** KAN-85 · **Ticket:** KAN-109

## Qué cambió

Nueva pestaña **"Cobertura"** en el panel del proveedor
(`/proveedor/cobertura`), y el checkout del comprador ahora la respeta.

| Criterio | Cómo |
|---|---|
| CRUD de cobertura por región o comuna con costo y plazo | Tabla de zonas agrupadas por región (norte a sur): "Toda la región" o una comuna, con su costo ("Gratis" si es 0) y su plazo ("el de la oferta" si no tiene). Se editan en la misma fila (costo y plazo), se quitan, y se agregan eligiendo región, comuna (o toda la región), costo y plazo opcional. Una zona repetida responde `409 ZONA_DUPLICADA` |
| CRUD de puntos de retiro (dirección, horario, activo) | Lista con nombre, dirección, horario y estado (Activo o Inactivo). Se crean, se editan (nombre, horario, dirección), se activan o desactivan y se borran. Uno con retiros pasados no se borra, solo se desactiva (`409 PUNTO_USADO`). Si el proveedor ofrece retiro, no puede quedar sin puntos activos (`409 ULTIMO_PUNTO_RETIRO`) |
| El checkout solo ofrece despacho si la comuna del cliente está cubierta | `GET /carro/opciones-entrega` trae las zonas de los proveedores del carro. En el paso "Entrega", si la comuna elegida no está cubierta, el despacho de ese distribuidor aparece deshabilitado ("no despacha a Ñuñoa") y se propone el retiro. Si tampoco hay retiro, lo dice y pide otra dirección o quitarlo del carro. El costo de despacho sale de la zona que cubre la comuna elegida |

### API

- `GET /proveedor/cobertura/regiones`, `POST/PATCH/DELETE
  /proveedor/cobertura/zonas[/:id]`, `GET/POST/PATCH/DELETE
  /proveedor/puntos-retiro[/:id]` (nuevos). `GET /proveedor/cobertura` trae
  el `id` de cada zona.
- `GET /carro/opciones-entrega`: `coberturas` y `regionCodigo` en las
  direcciones (aditivos, anotados en `apps/mobile/API_CONTRACT.md`).

## Por qué así

- **La regla del checkout es la misma del backend**: la zona de la comuna
  primero y, si no hay, la de toda su región, igual que `planificarOrden`. El
  backend la seguía imponiendo (`409 SIN_COBERTURA` al confirmar). Lo nuevo
  es que el comprador lo ve antes de pagar, no como un error al final.
- **La dirección se pide aunque el despacho quede deshabilitado.** Si la
  dirección solo apareciera con un despacho elegido, el comprador no podría
  cambiar a una comuna cubierta.
- **Zona repetida revisada en la aplicación**: el UNIQUE
  `(proveedor_id, region_codigo, comuna_id)` no impide dos zonas de región
  entera, porque en MySQL dos `NULL` no chocan.
- **Un punto con retiros se desactiva, no se borra**: lo cita `orden_envio`,
  y el detalle de esas órdenes debe seguir mostrando dónde se retiró.
- **Una dirección nueva no pisa la anterior**, como en el perfil (KAN-108),
  por la misma razón.
- **Despacho y retiro se activan en el perfil**, no aquí. Esta pantalla avisa
  si el proveedor no ofrece uno de los dos y enlaza al perfil.

## Pruebas

- Application (`cobertura-proveedor.use-cases.test.ts`, nuevo):
  - Regiones con sus comunas.
  - Crear una zona por comuna (la región sale de la comuna) o por región.
  - Duplicada 409; comuna o región inexistente 400.
  - Editar y borrar; una zona ajena 404.
  - Puntos: crear, desactivar y reactivar; no quedar sin activos si ofrece retiro; borrar uno sin retiros; uno usado 409.
- Infrastructure:
  - `proveedor.repository.test.ts`: CRUD de zonas y de puntos, sin tocar los de otro proveedor; una dirección nueva no pisa la anterior.
  - `checkout.repository.test.ts`: `opcionesEntrega` trae las zonas de los proveedores pedidos y la región de la dirección.
- Backend (`routes/ordenes/ordenes.test.ts`): 401 y 403, crear 201, duplicada 409, borrar 204, ajena 404, regiones y punto usado 409.
- Ecommerce:
  - `features/proveedor/cobertura.spec.ts`: zonas por región, agregar, duplicada, editar y quitar; puntos crear, desactivar con 409 y editar solo lo que cambió.
  - `features/checkout/checkout.spec.ts`: Los Andes cubre Ñuñoa por la región y cobra su zona. Valle Central no la cubre: despacho deshabilitado y aviso al pagar. Con una dirección nueva en una comuna cubierta, el despacho vuelve con su tarifa.
- En el navegador (Chrome) como Los Andes:
  - Se agregó la zona Ñuñoa a $2.990 en 12 h, y una repetida mostró el aviso.
  - Desactivar Bodega Quilicura, el único punto activo, mostró el 409.
  - Se creó "Bodega Ñuñoa", se desactivó y se borró, y se quitó la zona.
  - Con la zona puesta, la API de El Fogón (carro de prueba con Los Andes y Valle Central) devolvió las zonas de ambos, incluida la de Ñuñoa.
  - Después se borraron el carro de prueba, la dirección y las filas de auditoría.

## Archivos

- `packages/domain/src/dtos/proveedor.dto.ts` (zonas y puntos), `repositories/proveedor.repository.ts` (`NuevaZona`, `PuntoRetiroProveedor`, métodos), `repositories/carro.repository.ts` (`coberturas`, `regionCodigo`).
- `packages/application/src/use-cases/cobertura-proveedor.use-cases.ts` y su test.
- `packages/infrastructure/src/repositories/proveedor.repository.ts`, `carro.repository.ts`; `test/proveedor.repository.test.ts`, `test/checkout.repository.test.ts`.
- `apps/backend/src/routes/panel-proveedor/index.ts`, `routes/ordenes/ordenes.test.ts`.
- `apps/ecommerce/src/app/features/proveedor/cobertura.component.*`, `cobertura.spec.ts`, `panel-proveedor.component.ts` (pestaña), `core/proveedor/panel-proveedor.service.ts`, `app.routes.ts`; `features/checkout/checkout.component.*`, `checkout.spec.ts`, `core/models/checkout.models.ts`.
- `apps/mobile/API_CONTRACT.md` (`coberturas`).
