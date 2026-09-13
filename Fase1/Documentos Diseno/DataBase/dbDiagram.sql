Enum organizacion_tipo {
  cliente
  proveedor
  interna
}

Enum organizacion_estado {
  activa
  en_revision
  suspendida
}

Enum usuario_mfa_estado {
  activo
  pendiente
  opcional
  inactivo
}

Enum usuario_estado {
  activo
  invitado
  suspendido
}

Enum categoria_estado {
  activa
  oculta
}

Enum producto_unidad {
  kg
  "L"
  unidad
}

Enum producto_estado {
  borrador
  publicado
  archivado
}

Enum proveedor_documento_tipo {
  carpeta_tributaria
  resolucion_sanitaria
  vigencia
}

Enum proveedor_documento_estado {
  al_dia
  por_vencer
  vencido
}

Enum oferta_modalidad_entrega {
  despacho
  retiro
  ambos
}

Enum oferta_estado {
  borrador
  publicada
  pausada
}

Enum carro_estado {
  abierto
  convertido
  abandonado
}

Enum orden_estado {
  pendiente_pago
  pagada
  en_preparacion
  despachada
  entregada
  reembolsada
}

Enum pago_medio {
  tarjeta
  transferencia
  linea_credito
}

Enum pago_estado {
  autorizado
  pagado
  fallido
  reembolsado
}

Enum orden_envio_modalidad {
  despacho
  retiro
}

Enum orden_envio_estado {
  por_despachar
  en_preparacion
  listo_retiro
  despachado
  entregado
  cancelado
}

Enum dte_estado_sii {
  pendiente
  enviado
  aceptado
  rechazado
}

Enum liquidacion_estado {
  pendiente
  pagada
}

Enum evento_tipo {
  vista_producto
  click_oferta
  busqueda
}

Enum evento_origen {
  catalogo
  busqueda
  directo
}

Enum auditoria_accion {
  crear
  editar
  eliminar
  aprobar
  suspender
  reembolsar
}

Enum moderacion_tipo {
  alta_proveedor
  ficha_duplicada
  precio_fuera_rango
  reembolso
}

Enum moderacion_estado {
  abierto
  resuelto
  descartado
}

// =======================================================================
// 5.1 IDENTIDAD Y PERMISOS
// =======================================================================

Table organizacion {
  id                       bigint [pk, increment]
  tipo                     organizacion_tipo [not null]
  razon_social             varchar(180) [not null]
  rut                      varchar(12) [unique, not null]
  nombre_fantasia          varchar(180)
  giro                     varchar(180)
  email_contacto           varchar(160)
  telefono                 varchar(24)
  direccion_id             bigint [ref: > direccion.id]
  estado                   organizacion_estado [not null, default: 'en_revision']
  comision_pct             decimal(5,2) [note: 'solo aplica si tipo = proveedor']
  plazo_estandar_horas     smallint [note: 'solo proveedor']
  plazo_fuera_region_horas smallint [note: 'solo proveedor']
  hora_corte               time [note: 'solo proveedor']
  despacho_gratis_desde    "int unsigned" [note: 'solo proveedor']
  ofrece_despacho          tinyint(1) [note: 'solo proveedor']
  ofrece_retiro            tinyint(1) [note: 'solo proveedor']
  entregas_a_tiempo_pct    decimal(5,2) [note: 'solo proveedor']
  banco                    varchar(60) [note: 'solo proveedor']
  cuenta_bancaria          varchar(40) [note: 'solo proveedor']
  creada_en                datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    tipo
  }

  Note: '''
    FUSIÓN: incluye lo que antes era la tabla proveedor (relación 1:1).
    Las columnas marcadas "solo proveedor" quedan NULL cuando tipo IN
    ('cliente','interna'). El antiguo proveedor_estado (pendiente/activo/
    suspendido) se mapea a organizacion_estado (en_revision/activa/
    suspendida). Empresa compradora, proveedor o equipo interno;
    concentra los datos legales.
  '''
}

Table usuario {
  id              bigint [pk, increment]
  organizacion_id bigint [not null, ref: > organizacion.id]
  rol_id          smallint [not null, ref: > rol.id]
  nombre          varchar(120) [not null]
  email           varchar(160) [unique, not null]
  rut             varchar(12)
  telefono        varchar(24)
  hash_clave      char(60) [not null]
  mfa_estado      usuario_mfa_estado [not null, default: 'inactivo']
  ultimo_acceso   datetime
  estado          usuario_estado [not null, default: 'invitado']

  indexes {
    estado
  }

  Note: 'Cuenta de acceso: una organización, un rol.'
}

Table rol {
  id                       smallint [pk, increment]
  codigo                   varchar(40) [unique, not null]
  nombre                   varchar(80) [not null]
  descripcion              varchar(240)
  es_sistema               tinyint(1) [not null, default: 0]
  permisos                 json [not null, note: 'objeto { "codigo_permiso": "ninguno|parcial|total" }']
  permisos_actualizado_por bigint [ref: > usuario.id]
  permisos_actualizado_en  datetime

  Note: '''
    FUSIÓN: reemplaza las tablas permiso + rol_permiso. Administrador
    general, editor de catálogo, soporte, proveedor, comprador. La
    columna "permisos" guarda la matriz completa como JSON, con el
    catálogo de códigos válidos (crear_producto, cargar_imagenes,
    aprobar_proveedor, ver_todas_ordenes, ver_ordenes_propias,
    publicar_precio_stock, emitir_reembolso, liquidar_proveedor,
    crear_usuario, cambiar_permisos, ver_auditoria) mantenido en
    aplicación. Trade-off: la matriz de permisos del panel admin ya no
    se puede consultar/filtrar con SQL relacional (JOIN, WHERE por
    nivel); se lee/escribe el objeto completo y se filtra en la app.
  '''
}

// =======================================================================
// 5.2 GEOGRAFÍA
// =======================================================================

Table comuna {
  id            smallint [pk, increment]
  codigo        varchar(8) [unique, not null]
  nombre        varchar(80) [not null]
  region_codigo varchar(8) [not null]
  region_nombre varchar(80) [not null]
  region_orden  smallint

  indexes {
    nombre
    region_codigo
  }

  Note: '''
    FUSIÓN: incluye lo que antes era la tabla region (catálogo chico y
    estático de 16 regiones de Chile, sin necesidad de tabla propia).
  '''
}

Table direccion {
  id          bigint [pk, increment]
  comuna_id   smallint [not null, ref: > comuna.id]
  calle       varchar(160) [not null]
  numero      varchar(20)
  complemento varchar(80)
  referencia  varchar(240)
  latitud     decimal(9,6)
  longitud    decimal(9,6)

  Note: 'Dirección genérica reutilizable: facturación, entrega y bodega.'
}

// =======================================================================
// 5.3 CATÁLOGO MAESTRO
// =======================================================================

Table categoria {
  id       smallint [pk, increment]
  padre_id smallint [ref: > categoria.id]
  nombre   varchar(80) [not null]
  slug     varchar(80) [unique, not null]
  orden    smallint
  estado   categoria_estado [not null, default: 'activa']

  Note: '''
    Árbol de dos niveles. Nivel 1: Alimentos, Aseo y hogar. Nivel 2 de
    Alimentos: Secos, Legumbres, Refrigerados, Congelados, Bebidas.
    Nivel 2 de Aseo y hogar: Aseo, Baño, Cocina, Muebles. padre_id NULL
    en las categorías de nivel 1.
  '''
}

Table producto {
  id                        bigint [pk, increment]
  categoria_id              smallint [not null, ref: > categoria.id]
  sku                       varchar(24) [unique, not null]
  ean                       varchar(14) [unique]
  nombre                    varchar(180) [not null]
  marca                     varchar(80)
  formato                   varchar(80)
  contenido                 decimal(10,3)
  unidad                    producto_unidad [not null]
  descripcion               text
  precio_referencia         "int unsigned"
  tope_sobre_referencia_pct smallint
  imagenes                  json [note: 'array [{url, texto_alt, orden, es_principal, subida_por, subida_en}]; una sola con es_principal=true validado en aplicación']
  estado                    producto_estado [not null, default: 'borrador']
  creado_por                bigint [ref: > usuario.id]
  creado_en                 datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    nombre [name: 'ix_producto_nombre_fulltext', note: 'Crear como FULLTEXT en MySQL: DBML no soporta el tipo fulltext nativamente, generar el DDL con ALTER TABLE ... ADD FULLTEXT']
    estado
  }

  Note: '''
    La ficha compartida. Solo la crea administración. contenido + unidad
    permiten normalizar precio por kg/L entre formatos distintos de
    distintos proveedores. FUSIÓN: incluye lo que antes era la tabla
    producto_imagen, ahora como columna JSON "imagenes" (galería
    simple, sin necesidad de filas propias).
  '''
}

// =======================================================================
// 5.4 PROVEEDORES
// (proveedor en sí vive ahora en organizacion; estas tablas referencian
//  organizacion.id y deben corresponder a una fila con tipo='proveedor')
// =======================================================================

Table punto_retiro {
  id           bigint [pk, increment]
  proveedor_id bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  direccion_id bigint [not null, ref: > direccion.id]
  nombre       varchar(120) [not null]
  horario      varchar(180)
  activo       tinyint(1) [not null, default: 1]

  Note: 'Bodega o local donde el cliente retira; solo aplica si organizacion.ofrece_retiro = 1.'
}

Table proveedor_cobertura {
  id             bigint [pk, increment]
  proveedor_id   bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  comuna_id      smallint [ref: > comuna.id, note: 'NULL = toda la región (usar region_codigo aparte si se requiere)']
  region_codigo  varchar(8) [not null]
  costo_despacho "int unsigned" [not null]
  plazo_horas    smallint

  indexes {
    (proveedor_id, region_codigo, comuna_id) [unique]
  }

  Note: 'Dónde despacha el proveedor y a qué costo; comuna_id NULL = toda la región (identificada por region_codigo).'
}

Table proveedor_documento {
  id           bigint [pk, increment]
  proveedor_id bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  tipo         proveedor_documento_tipo [not null]
  url          varchar(300) [not null]
  vence_en     date
  estado       proveedor_documento_estado [not null, default: 'al_dia']
  revisado_por bigint [ref: > usuario.id]

  indexes {
    vence_en
  }

  Note: 'Carpeta tributaria, resolución sanitaria, vigencia.'
}

// =======================================================================
// 5.5 OFERTAS (el corazón del comparador)
// =======================================================================

Table oferta {
  id                bigint [pk, increment]
  producto_id       bigint [not null, ref: > producto.id]
  proveedor_id      bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  precio_unitario   "int unsigned" [not null]
  unidades_por_caja smallint [note: 'unsigned']
  cajas_disponibles "int unsigned"
  cajas_iniciales   "int unsigned"
  minimo_compra     smallint [note: 'unsigned, en unidades']
  plazo_horas       smallint
  modalidad_entrega oferta_modalidad_entrega [not null]
  notas_cliente     varchar(240)
  estado            oferta_estado [not null, default: 'borrador']
  actualizada_en    datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    (producto_id, proveedor_id) [unique]
    (producto_id, precio_unitario) [name: 'ix_oferta_comparador']
    estado
  }

  Note: '''
    Una fila por producto × proveedor. Precio VIGENTE (sin versionado
    desde/hasta). El comparador lee precio_unitario directo usando el
    índice (producto_id, precio_unitario). Los cambios de precio/stock
    se registran en oferta_precio_historial (solo inserción; se
    mantiene como tabla propia, no se fusiona con auditoria_log, para
    no reabrir esa decisión ya tomada ni perder su índice dedicado).
  '''
}

Table oferta_precio_historial {
  id               bigint [pk, increment]
  oferta_id        bigint [not null, ref: > oferta.id]
  precio_anterior  "int unsigned"
  precio_nuevo     "int unsigned"
  cajas_anteriores "int unsigned"
  cajas_nuevas     "int unsigned"
  motivo           varchar(120)
  cambiado_por     bigint [ref: > usuario.id]
  cambiado_en      datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    cambiado_en
  }

  Note: 'SOLO INSERCIÓN. Bitácora de cambios de precio y stock de una oferta.'
}

// =======================================================================
// 5.6 CARRO Y ÓRDENES
// =======================================================================

Table carro {
  id             bigint [pk, increment]
  usuario_id     bigint [not null, ref: > usuario.id]
  estado         carro_estado [not null, default: 'abierto']
  items          json [not null, note: 'array [{oferta_id, cantidad, precio_visto}]; unicidad por oferta_id validada en aplicación']
  actualizado_en datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    estado
  }

  Note: '''
    Carro único del cliente; mezcla ofertas de proveedores distintos.
    FUSIÓN: incluye lo que antes era la tabla carro_linea, ahora como
    columna JSON "items" (el carro es efímero hasta convertirse en
    orden, no necesita filas propias ni FKs por línea).
  '''
}

Table orden {
  id                    bigint [pk, increment]
  codigo                varchar(16) [unique, not null]
  usuario_id            bigint [not null, ref: > usuario.id]
  organizacion_id       bigint [not null, ref: > organizacion.id]
  direccion_entrega_id  bigint [ref: > direccion.id]
  subtotal              "int unsigned" [not null]
  costo_despacho_total  "int unsigned" [not null]
  comision_total        "int unsigned" [not null]
  total                 "int unsigned" [not null]
  requiere_factura      tinyint(1) [not null, default: 0]
  estado                orden_estado [not null, default: 'pendiente_pago']
  medio_pago            pago_medio
  estado_pago           pago_estado [not null, default: 'autorizado']
  referencia_pasarela   varchar(80)
  creada_en             datetime [not null, default: `CURRENT_TIMESTAMP`]
  pagado_en             datetime

  indexes {
    estado
    estado_pago
  }

  Note: '''
    Lo que el cliente paga una sola vez. codigo es el folio visible
    (CM-90412). FUSIÓN: incluye lo que antes era la tabla pago
    (medio_pago, estado_pago, referencia_pasarela, pagado_en), alineado
    con la regla "una orden = un pago del cliente". Si en el futuro se
    necesitan reintentos de pago fallido, esta fusión se debe revertir.
  '''
}

Table orden_envio {
  id                      bigint [pk, increment]
  orden_id                bigint [not null, ref: > orden.id]
  proveedor_id            bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  modalidad               orden_envio_modalidad [not null]
  punto_retiro_id         bigint [ref: > punto_retiro.id]
  direccion_entrega_id    bigint [ref: > direccion.id]
  plazo_horas             smallint
  costo_despacho          "int unsigned"
  subtotal                "int unsigned" [not null]
  comision_pct            decimal(5,2) [not null]
  comision_monto          "int unsigned" [not null]
  estado                  orden_envio_estado [not null, default: 'por_despachar']
  liquidacion_id          bigint [ref: > liquidacion.id, note: 'se completa cuando este envío entra en un corte semanal']
  monto_bruto_liquidado   "int unsigned"
  comision_liquidada      "int unsigned"
  monto_neto_liquidado    "int unsigned"
  actualizado_en          datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    (proveedor_id, estado)
  }

  Note: '''
    El tramo de cada proveedor dentro de una orden; es lo único que el
    proveedor ve en su panel. punto_retiro_id se exige si modalidad =
    retiro; direccion_entrega_id si modalidad = despacho; nunca ambos.
    Aplicar CHECK (MySQL 8.0.16+) o validación en aplicación para la
    exclusión mutua. FUSIÓN: incluye lo que antes era la tabla
    liquidacion_detalle (liquidacion_id + montos liquidados), ya que un
    envío se liquida una sola vez (relación 1:1 real con liquidacion).
  '''
}

Table orden_linea {
  id              bigint [pk, increment]
  orden_envio_id  bigint [not null, ref: > orden_envio.id]
  oferta_id       bigint [not null, ref: > oferta.id]
  producto_id     bigint [not null, ref: > producto.id]
  nombre_producto varchar(180) [not null]
  formato         varchar(80)
  precio_unitario "int unsigned" [not null]
  cantidad        "int unsigned" [not null]
  total_linea     "int unsigned" [not null]

  Note: '''
    Cuelga del ENVÍO, no de la orden. Congela nombre_producto, formato y
    precio_unitario al momento de la compra, para que editar la oferta
    después no altere órdenes ya emitidas. Se mantiene como tabla propia
    (no JSON) porque el panel proveedor necesita agregarla por
    producto/semana para "productos más vendidos". FK ON DELETE CASCADE.
  '''
}

// =======================================================================
// 5.7 SII Y LIQUIDACIONES
// (pago se fusionó en orden; liquidacion_detalle se fusionó en orden_envio)
// =======================================================================

Table documento_tributario {
  id             bigint [pk, increment]
  tipo_dte       smallint [not null, note: '33 factura, 39 boleta, 52 guía, 61 nota de crédito']
  folio          "int unsigned" [not null]
  orden_id       bigint [ref: > orden.id]
  orden_envio_id bigint [ref: > orden_envio.id]
  emisor_rut     varchar(12) [not null]
  receptor_rut   varchar(12)
  neto           "int unsigned"
  iva            "int unsigned"
  total          "int unsigned" [not null]
  track_id_sii   varchar(40)
  estado_sii     dte_estado_sii [not null, default: 'pendiente']
  xml_url        varchar(300)
  pdf_url        varchar(300)
  emitido_en     datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    tipo_dte
    estado_sii
    (tipo_dte, folio, emisor_rut) [unique]
  }

  Note: '''
    DTE del SII. La guía de despacho (52) se asocia al ENVÍO
    (orden_envio_id); la boleta (39) o factura (33) a la ORDEN
    (orden_id); nota de crédito (61) para reembolsos. Folio irrepetible
    por (tipo_dte, folio, emisor_rut). Se mantiene separada de orden
    porque puede haber varios documentos por orden/envío.
  '''
}

Table liquidacion {
  id            bigint [pk, increment]
  proveedor_id  bigint [not null, ref: > organizacion.id, note: 'debe ser una organizacion con tipo = proveedor']
  periodo_desde date [not null]
  periodo_hasta date [not null]
  monto_bruto   "int unsigned" [not null]
  comision      "int unsigned" [not null]
  monto_neto    "int unsigned" [not null]
  estado        liquidacion_estado [not null, default: 'pendiente']
  pagada_en     datetime

  indexes {
    estado
  }

  Note: '''
    Corte semanal por proveedor (lo entregado y confirmado la semana
    anterior; se liquida los martes). El detalle por envío ya no vive
    en una tabla aparte: se obtiene con
    orden_envio WHERE liquidacion_id = liquidacion.id.
  '''
}

// =======================================================================
// 5.8 ANALÍTICA (evento único; particionar por mes en creado_en)
// =======================================================================

Table evento_analitico {
  id           bigint [pk, increment]
  tipo_evento  evento_tipo [not null]
  producto_id  bigint [ref: > producto.id, note: 'usado en vista_producto y click_oferta']
  oferta_id    bigint [ref: > oferta.id, note: 'usado solo en click_oferta']
  usuario_id   bigint [ref: > usuario.id, note: 'NULL si anónimo']
  sesion_id    char(36) [not null]
  comuna_id    smallint [ref: > comuna.id]
  origen       evento_origen [note: 'usado solo en vista_producto']
  convirtio    tinyint(1) [note: 'usado solo en click_oferta']
  termino      varchar(160) [note: 'usado solo en busqueda']
  resultados   smallint [note: 'unsigned; usado solo en busqueda']
  detalle      json [note: 'payload adicional libre por tipo_evento, si se necesita']
  creado_en    datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    tipo_evento
    sesion_id
    creado_en
    producto_id
    oferta_id
  }

  Note: '''
    FUSIÓN: reemplaza producto_vista + oferta_click + busqueda. Una
    fila por evento; las columnas no aplicables al tipo_evento quedan
    NULL (ver notas por columna). Vistas vs clicks (agrupando por
    producto_id/oferta_id) siguen dando la conversión del panel
    proveedor; búsquedas con resultados = 0 siguen indicando huecos de
    catálogo. Trade-off: se pierde algo de tipado estricto por columna
    a cambio de una sola tabla con un solo set de índices que mantener.
    Particionar por mes (creado_en).
  '''
}

// =======================================================================
// 5.9 AUDITORÍA
// =======================================================================

Table auditoria_log {
  id            bigint [pk, increment]
  usuario_id    bigint [ref: > usuario.id]
  entidad       varchar(60) [not null, note: 'nombre de la tabla afectada (referencia polimórfica)']
  entidad_id    bigint [not null]
  accion        auditoria_accion [not null]
  datos_antes   json
  datos_despues json
  ip            varbinary(16)
  creado_en     datetime [not null, default: `CURRENT_TIMESTAMP`]

  indexes {
    entidad
    creado_en
  }

  Note: '''
    SOLO INSERCIÓN. Aprobaciones de proveedor, ediciones de ficha,
    reembolsos, cambios de permisos. entidad + entidad_id es una
    referencia polimórfica: no lleva FK declarada, se resuelve en
    aplicación según el valor de "entidad".
  '''
}

Table moderacion_caso {
  id          bigint [pk, increment]
  tipo        moderacion_tipo [not null]
  entidad     varchar(60) [not null, note: 'referencia polimórfica, igual que auditoria_log']
  entidad_id  bigint [not null]
  detalle     varchar(300)
  estado      moderacion_estado [not null, default: 'abierto']
  asignado_a  bigint [ref: > usuario.id]
  creado_en   datetime [not null, default: `CURRENT_TIMESTAMP`]
  resuelto_en datetime

  indexes {
    tipo
    estado
  }

  Note: 'La cola del panel de administración: altas de proveedor, fichas duplicadas, precio fuera de rango, reembolsos.'
}

// =======================================================================
// TABLE GROUPS (los nueve dominios, ajustados a las fusiones)
// =======================================================================

TableGroup "5.1 Identidad y permisos" {
  organizacion
  usuario
  rol
}

TableGroup "5.2 Geografía" {
  comuna
  direccion
}

TableGroup "5.3 Catálogo maestro" {
  categoria
  producto
}

TableGroup "5.4 Proveedores" {
  punto_retiro
  proveedor_cobertura
  proveedor_documento
}

TableGroup "5.5 Ofertas" {
  oferta
  oferta_precio_historial
}

TableGroup "5.6 Carro y órdenes" {
  carro
  orden
  orden_envio
  orden_linea
}

TableGroup "5.7 SII y liquidaciones" {
  documento_tributario
  liquidacion
}

TableGroup "5.8 Analítica" {
  evento_analitico
}

TableGroup "5.9 Auditoría" {
  auditoria_log
  moderacion_caso
}