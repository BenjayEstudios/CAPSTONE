"""Genera la coleccion y el environment de Postman de la API de Cotizapp."""
import json
import sys
from pathlib import Path

# Uso: python3 docs/desarrollo/postman/generar-coleccion.py  (escribe al lado de este archivo)
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent

ADMIN = None  # hereda el bearer {{token}} de la coleccion
COMPRADOR = "tokenComprador"
PROVEEDOR = "tokenProveedor"
PUBLICO = "noauth"


def req(name, method, path, desc="", body=None, query=None, auth=ADMIN, events=None, form=None):
    parts = [p for p in path.strip("/").split("/")]
    url = {"raw": "{{baseUrl}}/" + "/".join(parts), "host": ["{{baseUrl}}"], "path": parts}
    if query:
        url["query"] = [{"key": k, "value": v, "disabled": dis, "description": d} for k, v, d, dis in query]
        enabled = [f"{q['key']}={q['value']}" for q in url["query"] if not q["disabled"]]
        if enabled:
            url["raw"] += "?" + "&".join(enabled)
    r = {"method": method, "header": [], "url": url, "description": desc}
    if body is not None:
        r["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2, ensure_ascii=False), "options": {"raw": {"language": "json"}}}
    if form is not None:
        r["body"] = {"mode": "formdata", "formdata": form}
    if auth == PUBLICO:
        r["auth"] = {"type": "noauth"}
    elif auth:
        r["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{" + auth + "}}", "type": "string"}]}
    item = {"name": name, "request": r}
    if events:
        item["event"] = events
    return item


def q(key, value, desc="", disabled=True):
    return (key, value, desc, disabled)


def script(listen, lines):
    return {"listen": listen, "script": {"type": "text/javascript", "exec": lines}}


def folder(name, desc, items):
    return {"name": name, "description": desc, "item": items}


PAGINACION = [q("pagina", "1", "default 1"), q("tamano", "20", "1-100, default 20")]

GUARDAR_TOKEN = script("test", [
    "const r = pm.response.json();",
    "if (r.token) {",
    "  pm.collectionVariables.set('token', r.token);",
    "  console.log('token guardado para', r.usuario && r.usuario.email);",
    "} else if (r.mfaRequerido) {",
    "  pm.collectionVariables.set('desafio', r.desafio);",
    "  console.log('MFA requerido: el codigo sale en la consola del backend (MAIL_DRIVER=consola)');",
    "}",
])


def firmar_token(variable, sub, org, rol):
    # HS256 firmado en el sandbox de Postman (CryptoJS viene incluido).
    return script("prerequest", [
        "// Solo dev: no hay login para organizaciones externas (POST /auth/admin/login",
        "// rechaza todo lo que no sea organizacion 'interna'). Se firma el JWT a mano",
        "// con {{jwtSecret}}, que debe ser igual al JWT_SECRET del .env del backend.",
        "const b64url = (wa) => CryptoJS.enc.Base64.stringify(wa).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');",
        "const json = (o) => b64url(CryptoJS.enc.Utf8.parse(JSON.stringify(o)));",
        "const ahora = Math.floor(Date.now() / 1000);",
        "const header = json({ alg: 'HS256', typ: 'JWT' });",
        f"const payload = json({{ sub: '{sub}', organizacionId: {org}, rol: '{rol}', iat: ahora, exp: ahora + 8 * 3600 }});",
        "const firma = b64url(CryptoJS.HmacSHA256(header + '.' + payload, pm.collectionVariables.get('jwtSecret')));",
        f"pm.collectionVariables.set('{variable}', header + '.' + payload + '.' + firma);",
    ])


sesion = folder("0 · Sesión", "Login del admin-site y tokens de prueba. Empezar por acá: **Login admin** guarda `{{token}}`, que usa toda la colección.", [
    req("Login admin", "POST", "/auth/admin/login",
        "Público. Solo usuarios de la organización interna (Cotizapp). Guarda `{{token}}`. Si el usuario tiene `mfa_estado=activo` responde `{ mfaRequerido, desafio }` y guarda `{{desafio}}`.",
        body={"email": "{{adminEmail}}", "clave": "{{clave}}"}, auth=PUBLICO, events=[GUARDAR_TOKEN]),
    req("MFA · verificar código", "POST", "/auth/admin/mfa",
        "Público, con límite de tasa. Segundo paso del 2FA: el código de 6 dígitos sale en la consola del backend con `MAIL_DRIVER=consola`. Guarda `{{token}}`.",
        body={"desafio": "{{desafio}}", "codigo": "123456"}, auth=PUBLICO, events=[GUARDAR_TOKEN]),
    req("MFA · reenviar código", "POST", "/auth/admin/mfa/reenviar", "Público, con límite de tasa.",
        body={"desafio": "{{desafio}}"}, auth=PUBLICO),
    req("Yo (sesión actual)", "GET", "/auth/me", "Cualquier token válido. Devuelve usuario, rol y matriz de permisos vigente."),
    req("Token dev · comprador El Fogón", "GET", "/auth/me",
        "Firma localmente un JWT de **compras@elfogon.test** (usuario 8, organización 6, rol comprador) y lo guarda en `{{tokenComprador}}`. Solo funciona si `{{jwtSecret}}` = `JWT_SECRET` del backend.",
        auth=COMPRADOR, events=[firmar_token(COMPRADOR, 8, 6, "comprador")]),
    req("Token dev · proveedor Los Andes", "GET", "/auth/me",
        "Firma localmente un JWT de **ventas@losandes.test** (usuario 4, organización 2, rol proveedor) y lo guarda en `{{tokenProveedor}}`.",
        auth=PROVEEDOR, events=[firmar_token(PROVEEDOR, 4, 2, "proveedor")]),
])

salud = folder("Health check", "", [req("Health check", "GET", "/health-check", "Público.", auth=PUBLICO)])

categorias = folder("Categorías", "Escritura: `crear_producto`. Lectura pública salvo `incluirOcultas=true`, que exige permiso de lectura de catálogo.", [
    req("Listar categorías", "GET", "/categorias", "Público si no se piden ocultas.",
        query=[q("arbol", "true", "true|false: devuelve el árbol padre/hijos"), q("incluirOcultas", "true", "requiere token con crear_producto o cargar_imagenes total")]),
    req("Crear categoría", "POST", "/categorias", "Permiso `crear_producto`. 201.",
        body={"nombre": "Congelados", "slug": "congelados", "padreId": None, "orden": 20}),
    req("Actualizar categoría", "PATCH", "/categorias/{{categoriaId}}", "Permiso `crear_producto`. Al menos un campo. `estado`: activa | oculta.",
        body={"nombre": "Congelados y helados", "estado": "activa"}),
])

productos = folder("Productos (catálogo maestro)", "Lectura: `crear_producto` o `cargar_imagenes` total. Escritura: `crear_producto`. Imágenes: `cargar_imagenes` total.", [
    req("Listar productos", "GET", "/productos", "",
        query=[q("estado", "publicado", "borrador | publicado | archivado"), q("categoriaId", "1"), q("q", "aceite", "búsqueda por texto")] + PAGINACION),
    req("Obtener producto", "GET", "/productos/{{productoId}}"),
    req("Crear producto", "POST", "/productos", "201. `unidad`: kg | L | unidad. `estado` default borrador. SKU se pasa a mayúsculas.",
        body={"nombre": "Arroz grado 1 grano largo", "sku": "ARR-G1-5KG", "ean": "7801234567890", "categoriaId": 1, "marca": "Tucapel",
              "formato": "Bolsa 5 kg", "contenido": 5, "unidad": "kg", "descripcion": "Arroz grado 1 para cocina profesional.",
              "precioReferencia": 6490, "topeSobreReferenciaPct": 30, "estado": "borrador"}),
    req("Actualizar producto", "PATCH", "/productos/{{productoId}}", "Al menos un campo.",
        body={"precioReferencia": 6990, "estado": "publicado"}),
    req("Subir archivo de imagen", "POST", "/productos/{{productoId}}/imagenes/archivo",
        "multipart/form-data, un archivo (campo con cualquier nombre), máx. `UPLOADS_MAX_MB` (5 MB). Devuelve `{ url, ancho, alto, clave }`; **no** lo asocia al producto: después va `PUT /productos/:id/imagenes`. Elegir el archivo en Body → form-data.",
        form=[{"key": "archivo", "type": "file", "src": []}]),
    req("Reemplazar imágenes", "PUT", "/productos/{{productoId}}/imagenes", "Reemplaza la lista completa (máx. 10). Ancho mínimo 1200 px.",
        body={"imagenes": [{"url": "{{baseUrl}}/uploads/ejemplo.jpg", "textoAlt": "Bolsa de arroz 5 kg", "esPrincipal": True, "orden": 0, "ancho": 1200, "alto": 1200}]}),
])

proveedores = folder("Proveedores", "Permiso `aprobar_proveedor`. `{{proveedorId}}` = id de la organización (seed: 2 Los Andes, 3 Valle Central, 4 FrigoSur, 5 Las Palmas en revisión).", [
    req("Listar proveedores", "GET", "/proveedores", "",
        query=[q("estado", "en_revision", "en_revision | activa | suspendida"), q("q", "andes")] + PAGINACION),
    req("Obtener proveedor", "GET", "/proveedores/{{proveedorId}}", "Incluye documentos: de acá sale `{{documentoId}}`."),
    req("Revisar documento", "PATCH", "/proveedores/{{proveedorId}}/documentos/{{documentoId}}/revision", "`decision`: aprobado | rechazado. `motivo` obligatorio al rechazar.",
        body={"decision": "rechazado", "motivo": "La resolución sanitaria está vencida"}),
    req("Aprobar proveedor", "POST", "/proveedores/{{proveedorId}}/aprobar", "`comisionPct` opcional (0-100).", body={"comisionPct": 8}),
    req("Rechazar proveedor", "POST", "/proveedores/{{proveedorId}}/rechazar", "", body={"motivo": "Documentación incompleta"}),
    req("Suspender proveedor", "POST", "/proveedores/{{proveedorId}}/suspender", "", body={"motivo": "Reclamos reiterados de despacho"}),
])

roles = folder("Roles y permisos", "Permiso `cambiar_permisos` total.", [
    req("Listar roles", "GET", "/roles", "Roles con su matriz y el catálogo de permisos."),
    req("Actualizar permisos de un rol", "PUT", "/roles/{{rolId}}/permisos", "Niveles: ninguno | parcial | total. Seed: 1 admin_general, 2 editor_catalogo, 3 soporte, 4 proveedor, 5 comprador.",
        body={"permisos": {"crear_producto": "total", "cargar_imagenes": "total", "ver_auditoria": "parcial"}}),
])

usuarios = folder("Usuarios", "Lectura: `crear_usuario`. Escritura: `crear_usuario` total.", [
    req("Listar usuarios", "GET", "/usuarios", "",
        query=[q("rolId", "2"), q("organizacionId", "1"), q("estado", "activo", "invitado | activo | suspendido"), q("q", "andes")] + PAGINACION),
    req("Opciones (roles y organizaciones)", "GET", "/usuarios/opciones", "Para poblar los selects del formulario."),
    req("Obtener usuario", "GET", "/usuarios/{{usuarioId}}"),
    req("Crear usuario", "POST", "/usuarios", "201. `modo`: invitacion | clave_temporal (el correo sale por consola con MAIL_DRIVER=consola). `mfa`: opcional | activo.",
        body={"nombre": "Paula Rojas", "email": "paula.rojas@cotizapp.test", "rolId": 3, "organizacionId": 1, "rut": "12345678-5",
              "telefono": "+56 9 1234 5678", "modo": "clave_temporal", "mfa": "opcional"}),
    req("Actualizar usuario", "PATCH", "/usuarios/{{usuarioId}}", "Al menos un campo. `mfaEstado`: inactivo | opcional | pendiente | activo.",
        body={"nombre": "Paula Rojas M.", "telefono": "+56 9 8765 4321"}),
    req("Suspender usuario", "POST", "/usuarios/{{usuarioId}}/suspender"),
    req("Reactivar usuario", "POST", "/usuarios/{{usuarioId}}/reactivar"),
])

auditoria = folder("Auditoría", "Permiso `ver_auditoria`. Solo lectura.", [
    req("Listar registros", "GET", "/auditoria", "",
        query=[q("entidad", "producto"), q("accion", "aprobar", "crear | editar | eliminar | aprobar | suspender | reembolsar"), q("usuarioId", "1"),
               q("desde", "2026-09-01", "yyyy-mm-dd"), q("hasta", "2026-10-31", "yyyy-mm-dd")] + PAGINACION),
    req("Valores para filtros", "GET", "/auditoria/filtros"),
    req("Obtener registro", "GET", "/auditoria/{{auditoriaId}}"),
])

moderacion = folder("Moderación", "Permiso `aprobar_proveedor`.", [
    req("Listar casos", "GET", "/moderacion/casos", "",
        query=[q("tipo", "alta_proveedor", "alta_proveedor | ficha_duplicada | precio_fuera_rango | reembolso"),
               q("estado", "abierto", "abierto | resuelto | descartado"), q("asignadoA", "sin_asignar", "sin_asignar o id de usuario")] + PAGINACION),
    req("Usuarios internos asignables", "GET", "/moderacion/usuarios-internos"),
    req("Obtener caso", "GET", "/moderacion/casos/{{casoId}}"),
    req("Asignar caso", "POST", "/moderacion/casos/{{casoId}}/asignar", "`usuarioId: null` desasigna.", body={"usuarioId": 3}),
    req("Resolver caso", "POST", "/moderacion/casos/{{casoId}}/resolver", "", body={"nota": "Documentación revisada y aprobada"}),
    req("Descartar caso", "POST", "/moderacion/casos/{{casoId}}/descartar", "", body={"motivo": "Caso duplicado"}),
])

eventos = folder("Eventos analíticos", "Públicos (token opcional: si viene y es válido se asocia el usuario). Límite de tasa por IP (60/min por defecto). Responden 202 sin cuerpo.", [
    req("Registrar evento · vista de producto", "POST", "/eventos", "Body máx. 2 KB. Validación estricta: campos extra → 400.",
        body={"tipo_evento": "vista_producto", "sesion_id": "postman-sesion-0001", "producto_id": 1, "origen": "catalogo", "comuna_id": 1}, auth=PUBLICO),
    req("Registrar evento · click en oferta", "POST", "/eventos", "",
        body={"tipo_evento": "click_oferta", "sesion_id": "postman-sesion-0001", "producto_id": 1, "oferta_id": 1, "convirtio": False}, auth=PUBLICO),
    req("Registrar evento · búsqueda", "POST", "/eventos", "",
        body={"tipo_evento": "busqueda", "sesion_id": "postman-sesion-0001", "termino": "Aceite Maravilla", "resultados": 3}, auth=PUBLICO),
    req("Registrar lote de eventos", "POST", "/eventos/lote", "1 a 20 eventos, body máx. 16 KB.",
        body={"eventos": [
            {"tipo_evento": "busqueda", "sesion_id": "postman-sesion-0002", "termino": "harina", "resultados": 2},
            {"tipo_evento": "vista_producto", "sesion_id": "postman-sesion-0002", "producto_id": 2, "origen": "busqueda"}]}, auth=PUBLICO),
])

estadisticas = folder("Estadísticas", "Rango máx. 366 días; sin fechas, últimos 30.", [
    req("Estadísticas de plataforma", "GET", "/estadisticas/plataforma", "Permiso `ver_todas_ordenes`.",
        query=[q("desde", "2026-09-01", "yyyy-mm-dd"), q("hasta", "2026-10-31", "yyyy-mm-dd")]),
    req("Estadísticas del proveedor", "GET", "/estadisticas/proveedor", "Permiso `ver_ordenes_propias`; usa la organización del token.",
        query=[q("desde", "2026-09-01"), q("hasta", "2026-10-31")], auth=PROVEEDOR),
])

carro = folder("Carro (comprador)", "Permiso `ver_ordenes_propias`. Usa `{{tokenComprador}}`: correr antes **0 · Sesión → Token dev · comprador El Fogón**.", [
    req("Ver carro", "GET", "/carro", "", auth=COMPRADOR),
    req("Reemplazar carro", "PUT", "/carro", "Reemplaza todos los ítems (máx. 100). `precioVisto` permite detectar cambios de precio al confirmar.",
        body={"items": [{"ofertaId": 1, "cantidad": 2, "precioVisto": 12490}]}, auth=COMPRADOR),
    req("Confirmar carro (crear orden)", "POST", "/carro/confirmar",
        "Usa `direccionId` existente **o** `direccion` nueva. `retiros`: proveedores cuyo envío se retira en un punto en vez de despacho (seed: punto 1 Los Andes, 2 FrigoSur).",
        body={"direccionId": 6, "retiros": [], "requiereFactura": False}, auth=COMPRADOR),
])

ordenes = folder("Órdenes", "Permiso `ver_ordenes_propias` (ve las de su organización) o `ver_todas_ordenes`. Con `{{token}}` admin ve todas.", [
    req("Listar órdenes", "GET", "/ordenes", "", query=[q("estado", "entregada", "pendiente_pago | pagada | en_preparacion | despachada | entregada | reembolsada")] + PAGINACION),
    req("Obtener orden", "GET", "/ordenes/{{ordenId}}"),
    req("Listar órdenes (comprador)", "GET", "/ordenes", "Las del comprador El Fogón.", query=PAGINACION, auth=COMPRADOR),
    req("Cambiar estado de envío (proveedor)", "PATCH", "/ordenes/envios/{{envioId}}/estado",
        "Lo hace el proveedor dueño del envío. `estado`: por_despachar | en_preparacion | listo_retiro | despachado | entregado | cancelado. Transición inválida → 409.",
        body={"estado": "en_preparacion"}, auth=PROVEEDOR),
])

documentos = folder("Documentos tributarios", "", [
    req("Listar documentos", "GET", "/documentos-tributarios", "Permiso `ver_ordenes_propias` o `ver_todas_ordenes`.",
        query=[q("ordenId", "{{ordenId}}"), q("tipo", "39", "33 factura | 39 boleta | 52 guía | 61 nota de crédito")] + PAGINACION),
    req("Descargar PDF", "GET", "/documentos-tributarios/{{documentoTributarioId}}/pdf", "Devuelve `application/pdf` (en Postman: Save response → Save to a file)."),
    req("Emitir documentos de una orden", "POST", "/ordenes/{{ordenId}}/documentos", "Permiso `ver_todas_ordenes` total."),
])

reembolsos = folder("Reembolsos", "Lectura: `emitir_reembolso`. Escritura: `emitir_reembolso` total.", [
    req("Buscar orden por código", "GET", "/reembolsos/buscar", "", query=[q("codigo", "CM-10001", "código de orden", disabled=False)]),
    req("Listar reembolsos de una orden", "GET", "/ordenes/{{ordenId}}/reembolsos"),
    req("Crear reembolso", "POST", "/ordenes/{{ordenId}}/reembolsos", "201. Sin `monto` = reembolso total; si supera lo reembolsable → 409.",
        body={"monto": 5000, "motivo": "Producto llegó dañado"}),
])

liquidaciones = folder("Liquidaciones", "Lectura: `liquidar_proveedor`. Generar y pagar: `liquidar_proveedor` total.", [
    req("Listar liquidaciones", "GET", "/liquidaciones", "",
        query=[q("proveedorId", "2"), q("estado", "pendiente", "pendiente | pagada"), q("desde", "2026-09-01"), q("hasta", "2026-10-31")] + PAGINACION),
    req("Mis liquidaciones (proveedor)", "GET", "/liquidaciones/mias", "Permiso `ver_ordenes_propias`; las de la organización del token.", query=PAGINACION, auth=PROVEEDOR),
    req("Obtener liquidación", "GET", "/liquidaciones/{{liquidacionId}}"),
    req("Generar liquidaciones", "POST", "/liquidaciones/generar", "Fechas opcionales (YYYY-MM-DD). Mismo cálculo que `pnpm --filter @cotizapp/backend job:liquidaciones`.",
        body={"desde": "2026-10-12", "hasta": "2026-10-18"}),
    req("Pagar liquidación", "POST", "/liquidaciones/{{liquidacionId}}/pagar", "Ya pagada → 409.", body={"fechaPago": "2026-10-24"}),
])

dashboard = folder("Dashboard", "Permiso `ver_todas_ordenes`.", [
    req("Resumen del mes", "GET", "/dashboard/resumen", "Sin `mes`, el mes actual.", query=[q("mes", "2026-10", "YYYY-MM")]),
])

VARIABLES = [
    ("baseUrl", "http://localhost:8000"),
    ("adminEmail", "admin@cotizapp.test"),
    ("clave", "Cotizapp.2026"),
    ("jwtSecret", "dev-secret-not-for-prod"),
    ("token", ""), ("desafio", ""), ("tokenComprador", ""), ("tokenProveedor", ""),
    ("categoriaId", "1"), ("productoId", "1"), ("proveedorId", "5"), ("documentoId", "1"),
    ("rolId", "2"), ("usuarioId", "2"), ("auditoriaId", "1"), ("casoId", "1"),
    ("ordenId", "1"), ("envioId", "1"), ("documentoTributarioId", "1"), ("liquidacionId", "1"),
]

coleccion = {
    "info": {
        "name": "Cotizapp API",
        "description": "Endpoints del backend Fastify (`apps/backend`). Ver `docs/desarrollo/postman/README.md`.\n\n"
                       "1. Levantar el backend y sembrar la base (`db:seed`).\n"
                       "2. Correr **0 · Sesión → Login admin**: guarda `{{token}}`.\n"
                       "3. Para carro y vistas de proveedor, correr los requests **Token dev** de la misma carpeta.",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{token}}", "type": "string"}]},
    "variable": [{"key": k, "value": v} for k, v in VARIABLES],
    "item": [sesion, salud, categorias, productos, proveedores, roles, usuarios, auditoria, moderacion,
             eventos, estadisticas, carro, ordenes, documentos, reembolsos, liquidaciones, dashboard],
}

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "cotizapp-api.postman_collection.json").write_text(json.dumps(coleccion, indent=2, ensure_ascii=False) + "\n")

total = sum(len(f["item"]) for f in coleccion["item"])
print("requests:", total)
