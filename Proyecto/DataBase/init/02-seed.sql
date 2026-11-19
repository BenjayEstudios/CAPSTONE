-- Datos semilla SOLO PARA DESARROLLO. Todo es ficticio (RUT, correos, precios).
-- Todas las cuentas usan la clave: cotizapp123
SET NAMES utf8mb4;

-- Roles ---------------------------------------------------------------------
INSERT INTO `rol` (`id`, `codigo`, `nombre`, `descripcion`, `es_sistema`, `permisos`) VALUES
(1, 'administrador', 'Administrador general', 'Acceso total al panel de administracion', 1,
 '{"crear_producto":"total","cargar_imagenes":"total","aprobar_proveedor":"total","ver_todas_ordenes":"total","ver_ordenes_propias":"total","publicar_precio_stock":"total","emitir_reembolso":"total","liquidar_proveedor":"total","crear_usuario":"total","cambiar_permisos":"total","ver_auditoria":"total"}'),
(2, 'editor_catalogo', 'Editor de catalogo', 'Gestiona fichas de producto y categorias', 1,
 '{"crear_producto":"total","cargar_imagenes":"total","aprobar_proveedor":"ninguno","ver_todas_ordenes":"ninguno","ver_ordenes_propias":"ninguno","publicar_precio_stock":"ninguno","emitir_reembolso":"ninguno","liquidar_proveedor":"ninguno","crear_usuario":"ninguno","cambiar_permisos":"ninguno","ver_auditoria":"parcial"}'),
(3, 'soporte', 'Soporte', 'Atiende ordenes y reembolsos', 1,
 '{"crear_producto":"ninguno","cargar_imagenes":"ninguno","aprobar_proveedor":"ninguno","ver_todas_ordenes":"total","ver_ordenes_propias":"total","publicar_precio_stock":"ninguno","emitir_reembolso":"parcial","liquidar_proveedor":"ninguno","crear_usuario":"ninguno","cambiar_permisos":"ninguno","ver_auditoria":"parcial"}'),
(4, 'proveedor', 'Proveedor / distribuidor', 'Publica ofertas y ve sus propias ordenes', 1,
 '{"crear_producto":"ninguno","cargar_imagenes":"parcial","aprobar_proveedor":"ninguno","ver_todas_ordenes":"ninguno","ver_ordenes_propias":"total","publicar_precio_stock":"total","emitir_reembolso":"ninguno","liquidar_proveedor":"ninguno","crear_usuario":"parcial","cambiar_permisos":"ninguno","ver_auditoria":"ninguno"}'),
(5, 'comprador', 'Comprador', 'Empresa cliente que cotiza y compra', 1,
 '{"crear_producto":"ninguno","cargar_imagenes":"ninguno","aprobar_proveedor":"ninguno","ver_todas_ordenes":"ninguno","ver_ordenes_propias":"total","publicar_precio_stock":"ninguno","emitir_reembolso":"ninguno","liquidar_proveedor":"ninguno","crear_usuario":"parcial","cambiar_permisos":"ninguno","ver_auditoria":"ninguno"}');

-- Comunas (muestra representativa) -----------------------------------------
INSERT INTO `comuna` (`id`, `codigo`, `nombre`, `region_codigo`, `region_nombre`, `region_orden`) VALUES
(1,  '13101', 'Santiago',     'RM',   'Region Metropolitana de Santiago', 13),
(2,  '13114', 'Las Condes',   'RM',   'Region Metropolitana de Santiago', 13),
(3,  '13123', 'Providencia',  'RM',   'Region Metropolitana de Santiago', 13),
(4,  '13119', 'Maipu',        'RM',   'Region Metropolitana de Santiago', 13),
(5,  '13110', 'La Florida',   'RM',   'Region Metropolitana de Santiago', 13),
(6,  '13201', 'Puente Alto',  'RM',   'Region Metropolitana de Santiago', 13),
(7,  '13124', 'Pudahuel',     'RM',   'Region Metropolitana de Santiago', 13),
(8,  '05101', 'Valparaiso',   'V',    'Region de Valparaiso', 5),
(9,  '05109', 'Vina del Mar', 'V',    'Region de Valparaiso', 5),
(10, '08101', 'Concepcion',   'VIII', 'Region del Biobio', 8),
(11, '08301', 'Los Angeles',  'VIII', 'Region del Biobio', 8),
(12, '04101', 'La Serena',    'IV',   'Region de Coquimbo', 4),
(13, '10101', 'Puerto Montt', 'X',    'Region de Los Lagos', 10),
(14, '02101', 'Antofagasta',  'II',   'Region de Antofagasta', 2),
(15, '09101', 'Temuco',       'IX',   'Region de La Araucania', 9);

INSERT INTO `direccion` (`id`, `comuna_id`, `calle`, `numero`, `complemento`) VALUES
(1, 1, 'Av. Libertador Bernardo O''Higgins', '1000', 'Of. 1'),
(2, 4, 'Camino a Melipilla', '15000', 'Bodega 3'),
(3, 3, 'Av. Providencia', '2200', 'Local 5');

-- Organizaciones ------------------------------------------------------------
INSERT INTO `organizacion`
(`id`, `tipo`, `razon_social`, `rut`, `nombre_fantasia`, `giro`, `email_contacto`, `telefono`, `direccion_id`, `estado`,
 `comision_pct`, `plazo_estandar_horas`, `plazo_fuera_region_horas`, `hora_corte`, `despacho_gratis_desde`, `ofrece_despacho`, `ofrece_retiro`) VALUES
(1, 'interna',   'Cotizapp SpA',               '76000001-1', 'Cotizapp',           'Plataforma de compras',     'contacto@cotizapp.test',  '+56220000000', 1,    'activa', NULL, NULL, NULL, NULL,       NULL,   NULL, NULL),
(2, 'proveedor', 'Distribuidora Andina Ltda.', '76000002-2', 'Andina Foods',       'Distribucion de alimentos', 'ventas@andina.test',      '+56221111111', 2,    'activa', 8.50, 48,   96,   '15:00:00', 150000, 1,    1),
(3, 'proveedor', 'Comercial Pacifico SpA',     '76000003-3', 'Pacifico Mayorista', 'Distribucion de abarrotes', 'ventas@pacifico.test',    '+56222222222', NULL, 'activa', 7.00, 72,   120,  '14:00:00', 200000, 1,    0),
(4, 'cliente',   'Restaurante La Esquina SpA', '76000004-4', 'La Esquina',         'Restaurante',               'compras@laesquina.test',  '+56223333333', 3,    'activa', NULL, NULL, NULL, NULL,       NULL,   NULL, NULL);

-- Usuarios (clave: cotizapp123, bcrypt cost 12) -----------------------------
INSERT INTO `usuario` (`id`, `organizacion_id`, `rol_id`, `nombre`, `email`, `hash_clave`, `mfa_estado`, `estado`) VALUES
(1, 1, 1, 'Admin Cotizapp',     'admin@cotizapp.test',      '$2a$12$1MUbzXSU5E18/ZsAx.k7SuANxdvWB7VC0f1fS91MhWnQX086qb6DW', 'inactivo', 'activo'),
(2, 1, 2, 'Editora Catalogo',   'catalogo@cotizapp.test',   '$2a$12$1MUbzXSU5E18/ZsAx.k7SuANxdvWB7VC0f1fS91MhWnQX086qb6DW', 'inactivo', 'activo'),
(3, 2, 4, 'Ventas Andina',      'proveedor@andina.test',    '$2a$12$1MUbzXSU5E18/ZsAx.k7SuANxdvWB7VC0f1fS91MhWnQX086qb6DW', 'inactivo', 'activo'),
(4, 3, 4, 'Ventas Pacifico',    'proveedor@pacifico.test',  '$2a$12$1MUbzXSU5E18/ZsAx.k7SuANxdvWB7VC0f1fS91MhWnQX086qb6DW', 'inactivo', 'activo'),
(5, 4, 5, 'Compras La Esquina', 'comprador@laesquina.test', '$2a$12$1MUbzXSU5E18/ZsAx.k7SuANxdvWB7VC0f1fS91MhWnQX086qb6DW', 'inactivo', 'activo');

-- Categorias ----------------------------------------------------------------
INSERT INTO `categoria` (`id`, `padre_id`, `nombre`, `slug`, `orden`, `estado`) VALUES
(1, NULL, 'Abarrotes',          'abarrotes',        1, 'activa'),
(2, NULL, 'Lacteos',            'lacteos',          2, 'activa'),
(3, NULL, 'Carnes y Embutidos', 'carnes-embutidos', 3, 'activa'),
(4, NULL, 'Frutas y Verduras',  'frutas-verduras',  4, 'activa'),
(5, NULL, 'Bebidas',            'bebidas',          5, 'activa'),
(6, 1,    'Arroz y Legumbres',  'arroz-legumbres',  1, 'activa'),
(7, 1,    'Aceites y Salsas',   'aceites-salsas',   2, 'activa'),
(8, 2,    'Leches',             'leches',           1, 'activa'),
(9, 2,    'Quesos',             'quesos',           2, 'activa');

-- Productos -----------------------------------------------------------------
INSERT INTO `producto`
(`id`, `categoria_id`, `sku`, `ean`, `nombre`, `marca`, `formato`, `contenido`, `unidad`, `descripcion`, `precio_referencia`, `tope_sobre_referencia_pct`, `estado`, `creado_por`) VALUES
(1, 6, 'ARR-001', '7801000000011', 'Arroz grado 1 largo ancho', 'Tucapel',   'Saco 25 kg',      25.000, 'kg', 'Arroz grado 1, saco institucional.', 1250, 20, 'publicado', 2),
(2, 6, 'LEN-001', '7801000000028', 'Lentejas 7 mm',             'Surena',    'Saco 25 kg',      25.000, 'kg', 'Lentejas seleccionadas.',            1900, 20, 'publicado', 2),
(3, 7, 'ACE-001', '7801000000035', 'Aceite vegetal',            'Chef',      'Bidon 5 L',        5.000, 'L',  'Aceite vegetal para cocina.',        2800, 20, 'publicado', 2),
(4, 8, 'LEC-001', '7801000000042', 'Leche entera UHT',          'Soprole',   'Caja 12 x 1 L',   12.000, 'L',  'Leche entera larga vida.',           1100, 15, 'publicado', 2),
(5, 9, 'QUE-001', '7801000000059', 'Queso gauda laminado',      'Colun',     'Bolsa 1 kg',       1.000, 'kg', 'Queso gauda laminado.',              7800, 15, 'publicado', 2),
(6, 5, 'BEB-001', '7801000000066', 'Agua mineral sin gas',      'Cachantun', 'Pack 6 x 1.5 L',   9.000, 'L',  'Agua mineral.',                       900, 20, 'publicado', 2),
(7, 4, 'VER-001', NULL,            'Papa blanca',               NULL,        'Saco 25 kg',      25.000, 'kg', 'Papa blanca de guarda.',             650, 25, 'borrador',  2);

-- Ofertas (dos proveedores compiten por el mismo producto) -------------------
INSERT INTO `oferta`
(`id`, `producto_id`, `proveedor_id`, `precio_unitario`, `unidades_por_caja`, `cajas_disponibles`, `cajas_iniciales`, `minimo_compra`, `plazo_horas`, `modalidad_entrega`, `estado`) VALUES
(1, 1, 2, 1180,  1, 200, 200,  1, 48, 'ambos',    'publicada'),
(2, 1, 3, 1230,  1, 120, 120,  2, 72, 'despacho', 'publicada'),
(3, 2, 2, 1850,  1,  80,  80,  1, 48, 'ambos',    'publicada'),
(4, 3, 2, 2700,  4, 150, 150,  1, 48, 'ambos',    'publicada'),
(5, 3, 3, 2760,  4, 100, 100,  1, 72, 'despacho', 'publicada'),
(6, 4, 3, 1050, 12, 300, 300,  5, 72, 'despacho', 'publicada'),
(7, 5, 2, 7500, 10,  60,  60,  1, 48, 'ambos',    'publicada'),
(8, 6, 2,  850,  6, 400, 400, 10, 48, 'ambos',    'pausada');
