# apps/backend

Backend Fastify + TypeScript. Es la **capa de interfaz HTTP**: expone rutas
que llaman a los casos de uso de `@cotizapp/application`, ya conectados a sus
dependencias reales en el composition root.

## Estructura

```
src/
├── server/
│   ├── index.ts   # entrypoint: carga env, arma la app, escucha el puerto
│   └── app.ts      # buildApp(): composition root — arma repos de
│                    infrastructure, los pasa a los casos de uso de
│                    application, registra plugins y el error handler
├── routes/          # un grupo de rutas por módulo de negocio
│   ├── auth/          # (pendiente)
│   ├── catalogo/       # (pendiente)
│   ├── pedidos/        # (pendiente)
│   └── pagos/           # (pendiente)
├── plugins/          # plugins de Fastify (auth, rate-limit, etc.)
├── config/
│   └── env.ts        # validación de variables de entorno con zod
└── types/
    └── fastify.d.ts   # augmentation de FastifyInstance (decorators)
```

## Cómo correrlo

```bash
cp .env.example .env
pnpm dev            # tsx watch, puerto 3000 por defecto
pnpm test
pnpm build && pnpm start
```

## Dónde va cada cosa

- **Lógica de negocio** (casos de uso) → `packages/application`, no acá.
- **Entidades/DTOs/interfaces de repositorio** → `packages/domain`, no acá.
- **Acceso a MySQL/Drizzle** → `packages/infrastructure`, no acá.
- Acá solo va: parseo de request/response, wiring de dependencias (composition
  root), middlewares/plugins HTTP, manejo de errores.

## Manejo de errores

`app.ts` registra un `setErrorHandler` centralizado que devuelve
`{ error: { code, message } }` con el status HTTP correspondiente.

## Autorizacion por permisos

`requirePermiso(...requisitos)` (`src/plugins/auth.ts`) se compone despues de
`requireAuth`. Lee el rol y el estado del usuario desde la DB en cada request
(no del JWT) y evalua la matriz `rol.permisos`. 401 si el usuario no existe o
no esta activo; 403 `FORBIDDEN` si el nivel es `ninguno`/ausente. Acepta
`"codigo"` (parcial o total) o `{ codigo, minimo: "total" }`; basta cumplir uno.

| Ruta | Requisito |
| --- | --- |
| POST/PATCH `/productos`, POST/PATCH `/categorias` | `crear_producto` |
| GET `/productos`, GET `/productos/:id`, GET `/categorias?incluirOcultas=true` | `crear_producto` o `cargar_imagenes` en `total` |
| PUT `/productos/:id/imagenes`, POST `/productos/:id/imagenes/archivo` | `cargar_imagenes` en `total` |

`cargar_imagenes: parcial` (rol proveedor) no basta: no hay modelo de
pertenencia producto-proveedor todavia.

## Subida de imagenes de producto

`POST /productos/:id/imagenes/archivo` (multipart, un archivo): valida firma
binaria JPG/PNG, tamano maximo y ancho minimo 1200 px; genera el nombre en el
servidor y responde `201 { url, clave, ancho, alto }`. No registra la imagen:
el cliente llama despues a `PUT /productos/:id/imagenes` con esos metadatos.
Los archivos se sirven (solo lectura, sin listado) en `/uploads/...`.

Variables de entorno:

| Variable | Default | Descripcion |
| --- | --- | --- |
| `CORS_ORIGIN` | `http://localhost:4200,http://localhost:4300` | Origenes permitidos por CORS; admite una lista separada por comas (se toleran espacios). |
| `STORAGE_DRIVER` | `local` | Adaptador de `AlmacenArchivos`. Hoy solo `local`. |
| `UPLOADS_DIR` | `./uploads` | Directorio de archivos (docker-compose: `/data/uploads`, volumen `backend-uploads`). |
| `UPLOADS_MAX_MB` | `5` | Tamano maximo por archivo. |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Base absoluta de las URL devueltas. |

Extension a DigitalOcean Spaces (no implementado): crear `AlmacenSpaces`
(S3-compatible) en `packages/infrastructure` que implemente `AlmacenArchivos`
(`packages/domain/src/services`), agregar `spaces` a `STORAGE_DRIVER` y un
`case` en `src/lib/storage.ts`.

## Moderacion y auditoria automatica

Endpoints (permiso `aprobar_proveedor`): `GET /moderacion/casos` (filtros `tipo`, `estado`, `asignadoA=<id>|sin_asignar`, `pagina`, `tamano`; abiertos primero, mas antiguos primero), `GET /moderacion/casos/:id`, `POST /moderacion/casos/:id/{asignar,resolver,descartar}` y `GET /moderacion/usuarios-internos`. Cada accion escribe `auditoria_log` (entidad `moderacion_caso`, accion `editar`, `datos_despues.operacion` = `asignar_caso|resolver_caso|descartar_caso`) en la misma transaccion. La nota/motivo vive solo en la auditoria (la tabla no tiene columna).

Para encolar un caso desde otro modulo (alta de proveedor, precio fuera de rango, reembolso, ficha duplicada) usa el caso de uso reutilizable de `@cotizapp/application`:

```ts
const { caso, creado } = await abrirCasoModeracion({ moderacionRepository: new DrizzleModeracionRepository(db) })(
  "precio_fuera_rango", "oferta", ofertaId, "Precio 40% sobre referencia", usuarioId /* opcional, null = sistema */
);
```

No duplica: si ya existe un caso `abierto` del mismo tipo + entidad + entidadId lo devuelve con `creado: false`. Registra `auditoria_log` (accion `crear`, operacion `abrir_caso`) en la misma transaccion.

Ficha de producto: crear, editar (incluye publicar/archivar, `operacion` = `publicar_producto|archivar_producto|editar_producto`) y reemplazo de imagenes escriben `auditoria_log` (entidad `producto`) en la misma transaccion, solo con los campos cambiados (la descripcion deja solo `descripcionModificada`).

## Usuarios y correo transaccional

Endpoints (`crear_usuario`: lectura en cualquier nivel, escritura en `total`): `GET /usuarios` (filtros `rolId`, `organizacionId`, `estado`, `q`, `pagina`, `tamano`), `GET /usuarios/opciones`, `GET /usuarios/:id`, `POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/{suspender,reactivar}`. Nunca devuelven `hash_clave`. Cada escritura registra `auditoria_log` (entidad `usuario`) en la misma transaccion, sin claves.

`POST /usuarios` genera una clave temporal (CSPRNG, 14 caracteres), guarda solo su hash bcrypt y deja al usuario `invitado`. Con `modo: "clave_temporal"` la respuesta la incluye UNA vez (`claveTemporal`); con `modo: "invitacion"` se envia por correo (`correoEnviado` indica si el envio funciono) y no se devuelve. El login admin acepta `invitado` y lo pasa a `activo` en el primer ingreso. Reglas: no puedes suspenderte ni cambiar tu propio rol/organizacion; no se suspende ni degrada al ultimo administrador activo (`cambiar_permisos` total) -> 409 `ULTIMO_ADMIN`. El cambio de clave propia queda para una historia posterior.

Correo (`ServicioCorreo`, `packages/domain/src/services`; selector en `src/lib/mail.ts`):

| Variable | Default | Descripcion |
| --- | --- | --- |
| `MAIL_DRIVER` | `consola` | `consola` (no envia; registra destinatario y asunto, nunca el cuerpo) o `smtp` (nodemailer). |
| `MAIL_OUT_DIR` | vacio | Solo `consola`: si se define, escribe el cuerpo de cada correo como .txt en ese directorio (util en dev para ver la clave temporal). No usar en produccion. |
| `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | - | Con `smtp`, `SMTP_HOST` y `SMTP_FROM` son obligatorios. Credenciales solo por entorno. |
| `ADMIN_SITE_URL` | `http://localhost:4300` | Enlace al panel en la invitacion. |

Plantillas en `packages/application/src/use-cases/correos.ts` (invitacion, nueva orden al proveedor, confirmacion de compra con folio, recuperacion de contrasena); las tres ultimas aun sin disparador. Tests usan `CorreoEnMemoria`.

## Segundo factor (2FA) por correo (KAN-112)

Aplica a usuarios con `mfa_estado = 'activo'` (los demas estados no lo exigen). No hay columna de secreto, asi que es un codigo por correo sin estado en BD:

1. `POST /auth/admin/login` valida la clave y responde `200 { mfaRequerido: true, desafio }` (sin token). El codigo de 6 digitos (CSPRNG) se envia por `ServicioCorreo` y nunca aparece en logs ni respuestas.
2. `POST /auth/admin/mfa { desafio, codigo }` verifica el desafio (JWT de 5 min con `{ sub, tipo: 'mfa', hash, jti }`, `hash` = HMAC-SHA256 del codigo con `JWT_SECRET` y el `sub`), compara en tiempo constante, registra `ultimo_acceso` y emite el JWT de sesion.
3. `POST /auth/admin/mfa/reenviar { desafio }` envia un codigo nuevo (invalida el desafio previo; maximo 3 por usuario cada 5 min).

Errores genericos: `401 MFA_INVALIDO` (codigo malo, expirado o desafio manipulado), `429 MFA_DEMASIADOS_INTENTOS` (5 fallos por usuario en 5 min; ademas hay limite por IP).

Limitaciones (sin estado servidor): los contadores de intentos/reenvios y los desafios ya usados viven en memoria del proceso (se pierden al reiniciar y no se comparten entre replicas). Un codigo valido es de un solo uso mientras el proceso viva; tras un reinicio podria reutilizarse hasta que expire (maximo 5 min). Mitigacion: expiracion corta y limite de intentos. Para un control global moverlo a Redis o a una tabla.

Dev: `docker-compose.yml` define `MAIL_DRIVER=consola` y `MAIL_OUT_DIR=/data/outbox`; el codigo se lee en el archivo mas reciente: `docker exec cotizapp-backend sh -c "ls -t /data/outbox | head -1"` y luego `cat` de ese archivo. Recrear el servicio (`docker compose up -d backend`) para aplicar.

## Liquidaciones semanales (KAN-152)

- Caso de uso `generarLiquidaciones`: agrupa por proveedor los `orden_envio` en estado `entregado`, sin `liquidacion_id`, cuyo cierre (`actualizado_en` al pasar a entregado) cae en el periodo. Crea una `liquidacion` por proveedor (una transaccion por proveedor), llena `monto_*_liquidado` en cada envio y registra `auditoria_log`.
- **Zona horaria: America/Santiago.** Semana = lunes 00:00 a domingo 23:59:59 hora de Chile (maneja horario de verano). Los datetime de la DB se tratan como instantes UTC.
- Montos por envio: bruto = `subtotal + costo_despacho`; comision = `comision_monto` del envio (NULL = 0, la comision aun no esta decidida por el negocio); neto = bruto - comision.
- Idempotente: un envio con `liquidacion_id` no se vuelve a liquidar; re-ejecutar el mismo periodo no crea nada.
- Ejecucion manual: `pnpm job:liquidaciones` (semana anterior) o `pnpm job:liquidaciones 2026-10-12 [2026-10-18]`. Sale con codigo 1 si algun proveedor falla.
- API: `POST /liquidaciones/generar {desde?,hasta?}`, `GET /liquidaciones`, `GET /liquidaciones/:id`, `POST /liquidaciones/:id/pagar {fechaPago}`, `GET /liquidaciones/mias` (proveedor). Permiso `liquidar_proveedor` (lectura cualquier nivel, escritura total).
- **Programarlo en produccion** (no se instala scheduler; el repo no lo incluye). Se liquida los martes sobre la semana anterior. Cron del host/contenedor, hora de Chile:
  `0 6 * * 2  cd /app/apps/backend && TZ=America/Santiago node dist/jobs/liquidaciones.js >> /var/log/liquidaciones.log 2>&1`
  (tras `pnpm build`; en dev `pnpm job:liquidaciones` usa tsx). Alternativas: Cron Job de DigitalOcean App Platform o GitHub Actions `schedule` ejecutando el mismo comando. Al ser idempotente, es seguro reintentar.

## Dashboard (KAN-113)

`GET /dashboard/resumen?mes=YYYY-MM` (permiso `ver_todas_ordenes`, solo lectura; mes por defecto = actual en America/Santiago).

- Orden contada: `estado_pago = pagado` y `estado <> reembolsada`, asignada al mes por `creada_en`. Monto transado = suma de `orden.total`.
- Comision = suma de `comision_monto` de envios no cancelados de ordenes contadas.
- Proveedores activos = proveedores `activa` con al menos un envio no cancelado en el mes.
- Proveedores por volumen (top 10): monto = suma de `subtotal` de sus envios; SKU = productos distintos vendidos.
- Semanas lunes a domingo recortadas al mes. Variacion % vs mes anterior (null si el anterior fue 0).
- Catalogo: sin imagen / sin ofertas publicadas (productos publicados); duplicada = mismo EAN o mismo nombre normalizado + formato (no archivados). Detalle maximo 20.

## Documentos tributarios simulados (KAN-153) y reembolsos (KAN-120)

**Simulacion**: no hay integracion real con el SII (fuera del MVP). Los DTE se "aceptan" al emitirse (`estado_sii = aceptado`, `track_id_sii = SIM-<tipo>-<folio>`), y el PDF
(generado al vuelo con un escritor PDF propio, sin dependencias; no se almacena, `pdf_url`/`xml_url` quedan null) lleva el texto "DOCUMENTO SIMULADO - SIN VALIDEZ TRIBUTARIA".

- Emision: `emitirDocumentosOrden(deps)(ordenId, usuarioId?)` (`@cotizapp/application`). **KAN-148 debe llamarlo al confirmar un pago** (orden con `estado_pago = pagado`; si no, 409 `ORDEN_NO_PAGADA`).
  Emite boleta (39) o factura (33 si `requiere_factura`) por orden y una guia de despacho (52) por envio no cancelado; es idempotente. Hoy un admin puede dispararlo con `POST /ordenes/:id/documentos` (ver_todas_ordenes total).
- Emisores: boleta/factura/nota de credito = plataforma (`SII_EMISOR_RUT`, por defecto `76000000-0`); guia = RUT del proveedor del envio. Neto = total/1,19 (los montos de la orden incluyen IVA).
- Folios: correlativos por (tipo, emisor) con `MAX(folio)+1` bajo lock dentro de la transaccion (orden bloqueada `FOR UPDATE`) y reintento ante clave duplicada/deadlock sobre el indice unico (tipo, folio, emisor).
- `GET /documentos-tributarios?ordenId=&tipo=&pagina=&tamano=` y `GET /documentos-tributarios/:id/pdf`: admin (ver_todas_ordenes) todo; cliente (ver_ordenes_propias) los de sus ordenes; proveedor solo guias de sus envios (lo ajeno = 404).
- Reembolsos (`emitir_reembolso`; escribir exige nivel total, leer cualquiera): `POST /ordenes/:id/reembolsos {monto?, motivo}` (sin monto = total del saldo), `GET /ordenes/:id/reembolsos`, `GET /reembolsos/buscar?codigo=CM-xxxx`.
  Cada reembolso emite una nota de credito (61) y registra `auditoria_log` (accion `reembolsar`, antes/despues, motivo) en la misma transaccion. 409 `ORDEN_NO_PAGADA` / `MONTO_EXCEDE_SALDO`.
  Sin tabla de reembolsos: el acumulado es la suma de las notas de credito. Parcial: `estado_pago` sigue `pagado` (el enum no tiene "parcial"); al cubrir el total: `estado_pago = reembolsado` y `orden.estado = reembolsada`.
- Punto de extension para devolver el dinero por pasarela (KAN-148): dependencia opcional `devolverDinero` de `crearReembolso` (se invoca tras confirmar la transaccion; resultado en `devolucionPasarela`).
