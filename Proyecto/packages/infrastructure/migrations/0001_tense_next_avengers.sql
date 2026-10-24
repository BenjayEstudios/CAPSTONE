CREATE TABLE `rol` (
	`id` smallint AUTO_INCREMENT NOT NULL,
	`codigo` varchar(40) NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`descripcion` varchar(240),
	`es_sistema` boolean NOT NULL DEFAULT false,
	`permisos` json NOT NULL,
	`permisos_actualizado_por` bigint,
	`permisos_actualizado_en` datetime,
	CONSTRAINT `rol_id` PRIMARY KEY(`id`),
	CONSTRAINT `rol_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `organizacion` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tipo` enum('cliente','proveedor','interna') NOT NULL,
	`razon_social` varchar(180) NOT NULL,
	`rut` varchar(12) NOT NULL,
	`nombre_fantasia` varchar(180),
	`giro` varchar(180),
	`email_contacto` varchar(160),
	`telefono` varchar(24),
	`direccion_id` bigint,
	`estado` enum('activa','en_revision','suspendida') NOT NULL DEFAULT 'en_revision',
	`comision_pct` decimal(5,2),
	`plazo_estandar_horas` smallint,
	`plazo_fuera_region_horas` smallint,
	`hora_corte` time,
	`despacho_gratis_desde` int unsigned,
	`ofrece_despacho` boolean,
	`ofrece_retiro` boolean,
	`entregas_a_tiempo_pct` decimal(5,2),
	`banco` varchar(60),
	`cuenta_bancaria` varchar(40),
	`creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `organizacion_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizacion_rut_unique` UNIQUE(`rut`)
);
--> statement-breakpoint
CREATE TABLE `usuario` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`organizacion_id` bigint NOT NULL,
	`rol_id` smallint NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`rut` varchar(12),
	`telefono` varchar(24),
	`hash_clave` char(60) NOT NULL,
	`mfa_estado` enum('activo','pendiente','opcional','inactivo') NOT NULL DEFAULT 'inactivo',
	`ultimo_acceso` datetime,
	`estado` enum('activo','invitado','suspendido') NOT NULL DEFAULT 'invitado',
	CONSTRAINT `usuario_id` PRIMARY KEY(`id`),
	CONSTRAINT `usuario_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `comuna` (
	`id` smallint AUTO_INCREMENT NOT NULL,
	`codigo` varchar(8) NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`region_codigo` varchar(8) NOT NULL,
	`region_nombre` varchar(80) NOT NULL,
	`region_orden` smallint,
	CONSTRAINT `comuna_id` PRIMARY KEY(`id`),
	CONSTRAINT `comuna_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `direccion` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`comuna_id` smallint NOT NULL,
	`calle` varchar(160) NOT NULL,
	`numero` varchar(20),
	`complemento` varchar(80),
	`referencia` varchar(240),
	`latitud` decimal(9,6),
	`longitud` decimal(9,6),
	CONSTRAINT `direccion_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `producto` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`categoria_id` smallint NOT NULL,
	`sku` varchar(24) NOT NULL,
	`ean` varchar(14),
	`nombre` varchar(180) NOT NULL,
	`marca` varchar(80),
	`formato` varchar(80),
	`contenido` decimal(10,3),
	`unidad` enum('kg','L','unidad') NOT NULL,
	`descripcion` text,
	`precio_referencia` int unsigned,
	`tope_sobre_referencia_pct` smallint,
	`imagenes` json,
	`estado` enum('borrador','publicado','archivado') NOT NULL DEFAULT 'borrador',
	`creado_por` bigint,
	`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `producto_id` PRIMARY KEY(`id`),
	CONSTRAINT `producto_sku_unique` UNIQUE(`sku`),
	CONSTRAINT `producto_ean_unique` UNIQUE(`ean`)
);
--> statement-breakpoint
CREATE TABLE `punto_retiro` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`direccion_id` bigint NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`horario` varchar(180),
	`activo` boolean NOT NULL DEFAULT true,
	CONSTRAINT `punto_retiro_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proveedor_cobertura` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`comuna_id` smallint,
	`region_codigo` varchar(8) NOT NULL,
	`costo_despacho` int unsigned NOT NULL,
	`plazo_horas` smallint,
	CONSTRAINT `proveedor_cobertura_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_proveedor_cobertura_proveedor_region_comuna` UNIQUE(`proveedor_id`,`region_codigo`,`comuna_id`)
);
--> statement-breakpoint
CREATE TABLE `proveedor_documento` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`tipo` enum('carpeta_tributaria','resolucion_sanitaria','vigencia') NOT NULL,
	`url` varchar(300) NOT NULL,
	`vence_en` date,
	`estado` enum('al_dia','por_vencer','vencido') NOT NULL DEFAULT 'al_dia',
	`revisado_por` bigint,
	CONSTRAINT `proveedor_documento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oferta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`producto_id` bigint NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`precio_unitario` int unsigned NOT NULL,
	`unidades_por_caja` smallint,
	`cajas_disponibles` int unsigned,
	`cajas_iniciales` int unsigned,
	`minimo_compra` smallint,
	`plazo_horas` smallint,
	`modalidad_entrega` enum('despacho','retiro','ambos') NOT NULL,
	`notas_cliente` varchar(240),
	`estado` enum('borrador','publicada','pausada') NOT NULL DEFAULT 'borrador',
	`actualizada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `oferta_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_oferta_producto_proveedor` UNIQUE(`producto_id`,`proveedor_id`)
);
--> statement-breakpoint
CREATE TABLE `oferta_precio_historial` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`oferta_id` bigint NOT NULL,
	`precio_anterior` int unsigned,
	`precio_nuevo` int unsigned,
	`cajas_anteriores` int unsigned,
	`cajas_nuevas` int unsigned,
	`motivo` varchar(120),
	`cambiado_por` bigint,
	`cambiado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `oferta_precio_historial_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `carro` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`usuario_id` bigint NOT NULL,
	`estado` enum('abierto','convertido','abandonado') NOT NULL DEFAULT 'abierto',
	`items` json NOT NULL,
	`actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `carro_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orden` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`codigo` varchar(16) NOT NULL,
	`usuario_id` bigint NOT NULL,
	`organizacion_id` bigint NOT NULL,
	`direccion_entrega_id` bigint,
	`subtotal` int unsigned NOT NULL,
	`costo_despacho_total` int unsigned NOT NULL,
	`comision_total` int unsigned NOT NULL,
	`total` int unsigned NOT NULL,
	`requiere_factura` boolean NOT NULL DEFAULT false,
	`estado` enum('pendiente_pago','pagada','en_preparacion','despachada','entregada','reembolsada') NOT NULL DEFAULT 'pendiente_pago',
	`medio_pago` enum('tarjeta','transferencia','linea_credito'),
	`estado_pago` enum('autorizado','pagado','fallido','reembolsado') NOT NULL DEFAULT 'autorizado',
	`referencia_pasarela` varchar(80),
	`creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`pagado_en` datetime,
	CONSTRAINT `orden_id` PRIMARY KEY(`id`),
	CONSTRAINT `orden_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `orden_envio` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orden_id` bigint NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`modalidad` enum('despacho','retiro') NOT NULL,
	`punto_retiro_id` bigint,
	`direccion_entrega_id` bigint,
	`plazo_horas` smallint,
	`costo_despacho` int unsigned,
	`subtotal` int unsigned NOT NULL,
	`comision_pct` decimal(5,2) NOT NULL,
	`comision_monto` int unsigned NOT NULL,
	`estado` enum('por_despachar','en_preparacion','listo_retiro','despachado','entregado','cancelado') NOT NULL DEFAULT 'por_despachar',
	`liquidacion_id` bigint,
	`monto_bruto_liquidado` int unsigned,
	`comision_liquidada` int unsigned,
	`monto_neto_liquidado` int unsigned,
	`actualizado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `orden_envio_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orden_linea` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orden_envio_id` bigint NOT NULL,
	`oferta_id` bigint NOT NULL,
	`producto_id` bigint NOT NULL,
	`nombre_producto` varchar(180) NOT NULL,
	`formato` varchar(80),
	`precio_unitario` int unsigned NOT NULL,
	`cantidad` int unsigned NOT NULL,
	`total_linea` int unsigned NOT NULL,
	CONSTRAINT `orden_linea_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documento_tributario` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tipo_dte` smallint NOT NULL,
	`folio` int unsigned NOT NULL,
	`orden_id` bigint,
	`orden_envio_id` bigint,
	`emisor_rut` varchar(12) NOT NULL,
	`receptor_rut` varchar(12),
	`neto` int unsigned,
	`iva` int unsigned,
	`total` int unsigned NOT NULL,
	`track_id_sii` varchar(40),
	`estado_sii` enum('pendiente','enviado','aceptado','rechazado') NOT NULL DEFAULT 'pendiente',
	`xml_url` varchar(300),
	`pdf_url` varchar(300),
	`emitido_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `documento_tributario_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_documento_tributario_tipo_folio_emisor` UNIQUE(`tipo_dte`,`folio`,`emisor_rut`)
);
--> statement-breakpoint
CREATE TABLE `liquidacion` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`periodo_desde` date NOT NULL,
	`periodo_hasta` date NOT NULL,
	`monto_bruto` int unsigned NOT NULL,
	`comision` int unsigned NOT NULL,
	`monto_neto` int unsigned NOT NULL,
	`estado` enum('pendiente','pagada') NOT NULL DEFAULT 'pendiente',
	`pagada_en` datetime,
	CONSTRAINT `liquidacion_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evento_analitico` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tipo_evento` enum('vista_producto','click_oferta','busqueda') NOT NULL,
	`producto_id` bigint,
	`oferta_id` bigint,
	`usuario_id` bigint,
	`sesion_id` char(36) NOT NULL,
	`comuna_id` smallint,
	`origen` enum('catalogo','busqueda','directo'),
	`convirtio` boolean,
	`termino` varchar(160),
	`resultados` smallint,
	`detalle` json,
	`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `evento_analitico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditoria_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`usuario_id` bigint,
	`entidad` varchar(60) NOT NULL,
	`entidad_id` bigint NOT NULL,
	`accion` enum('crear','editar','eliminar','aprobar','suspender','reembolsar') NOT NULL,
	`datos_antes` json,
	`datos_despues` json,
	`ip` varbinary(16),
	`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auditoria_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderacion_caso` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tipo` enum('alta_proveedor','ficha_duplicada','precio_fuera_rango','reembolso') NOT NULL,
	`entidad` varchar(60) NOT NULL,
	`entidad_id` bigint NOT NULL,
	`detalle` varchar(300),
	`estado` enum('abierto','resuelto','descartado') NOT NULL DEFAULT 'abierto',
	`asignado_a` bigint,
	`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`resuelto_en` datetime,
	CONSTRAINT `moderacion_caso_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rol` ADD CONSTRAINT `rol_permisos_actualizado_por_usuario_id_fk` FOREIGN KEY (`permisos_actualizado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizacion` ADD CONSTRAINT `organizacion_direccion_id_direccion_id_fk` FOREIGN KEY (`direccion_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_organizacion_id_organizacion_id_fk` FOREIGN KEY (`organizacion_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_rol_id_rol_id_fk` FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `direccion` ADD CONSTRAINT `direccion_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producto` ADD CONSTRAINT `producto_categoria_id_categoria_id_fk` FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producto` ADD CONSTRAINT `producto_creado_por_usuario_id_fk` FOREIGN KEY (`creado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `punto_retiro` ADD CONSTRAINT `punto_retiro_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `punto_retiro` ADD CONSTRAINT `punto_retiro_direccion_id_direccion_id_fk` FOREIGN KEY (`direccion_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_cobertura` ADD CONSTRAINT `proveedor_cobertura_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_cobertura` ADD CONSTRAINT `proveedor_cobertura_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_documento` ADD CONSTRAINT `proveedor_documento_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_documento` ADD CONSTRAINT `proveedor_documento_revisado_por_usuario_id_fk` FOREIGN KEY (`revisado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta` ADD CONSTRAINT `oferta_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta` ADD CONSTRAINT `oferta_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta_precio_historial` ADD CONSTRAINT `oferta_precio_historial_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta_precio_historial` ADD CONSTRAINT `oferta_precio_historial_cambiado_por_usuario_id_fk` FOREIGN KEY (`cambiado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carro` ADD CONSTRAINT `carro_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_organizacion_id_organizacion_id_fk` FOREIGN KEY (`organizacion_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_direccion_entrega_id_direccion_id_fk` FOREIGN KEY (`direccion_entrega_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_orden_id_orden_id_fk` FOREIGN KEY (`orden_id`) REFERENCES `orden`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_punto_retiro_id_punto_retiro_id_fk` FOREIGN KEY (`punto_retiro_id`) REFERENCES `punto_retiro`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_direccion_entrega_id_direccion_id_fk` FOREIGN KEY (`direccion_entrega_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_liquidacion_id_liquidacion_id_fk` FOREIGN KEY (`liquidacion_id`) REFERENCES `liquidacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_orden_envio_id_orden_envio_id_fk` FOREIGN KEY (`orden_envio_id`) REFERENCES `orden_envio`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documento_tributario` ADD CONSTRAINT `documento_tributario_orden_id_orden_id_fk` FOREIGN KEY (`orden_id`) REFERENCES `orden`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documento_tributario` ADD CONSTRAINT `documento_tributario_orden_envio_id_orden_envio_id_fk` FOREIGN KEY (`orden_envio_id`) REFERENCES `orden_envio`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liquidacion` ADD CONSTRAINT `liquidacion_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditoria_log` ADD CONSTRAINT `auditoria_log_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderacion_caso` ADD CONSTRAINT `moderacion_caso_asignado_a_usuario_id_fk` FOREIGN KEY (`asignado_a`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_organizacion_tipo` ON `organizacion` (`tipo`);--> statement-breakpoint
CREATE INDEX `ix_usuario_estado` ON `usuario` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_comuna_nombre` ON `comuna` (`nombre`);--> statement-breakpoint
CREATE INDEX `ix_comuna_region_codigo` ON `comuna` (`region_codigo`);--> statement-breakpoint
CREATE INDEX `ix_producto_nombre` ON `producto` (`nombre`);--> statement-breakpoint
CREATE INDEX `ix_producto_estado` ON `producto` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_proveedor_documento_vence_en` ON `proveedor_documento` (`vence_en`);--> statement-breakpoint
CREATE INDEX `ix_oferta_comparador` ON `oferta` (`producto_id`,`precio_unitario`);--> statement-breakpoint
CREATE INDEX `ix_oferta_estado` ON `oferta` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_oferta_precio_historial_cambiado_en` ON `oferta_precio_historial` (`cambiado_en`);--> statement-breakpoint
CREATE INDEX `ix_carro_estado` ON `carro` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_orden_estado` ON `orden` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_orden_estado_pago` ON `orden` (`estado_pago`);--> statement-breakpoint
CREATE INDEX `ix_orden_envio_proveedor_estado` ON `orden_envio` (`proveedor_id`,`estado`);--> statement-breakpoint
CREATE INDEX `ix_documento_tributario_tipo_dte` ON `documento_tributario` (`tipo_dte`);--> statement-breakpoint
CREATE INDEX `ix_documento_tributario_estado_sii` ON `documento_tributario` (`estado_sii`);--> statement-breakpoint
CREATE INDEX `ix_liquidacion_estado` ON `liquidacion` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_tipo_evento` ON `evento_analitico` (`tipo_evento`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_sesion_id` ON `evento_analitico` (`sesion_id`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_creado_en` ON `evento_analitico` (`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_producto_id` ON `evento_analitico` (`producto_id`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_oferta_id` ON `evento_analitico` (`oferta_id`);--> statement-breakpoint
CREATE INDEX `ix_auditoria_log_entidad` ON `auditoria_log` (`entidad`);--> statement-breakpoint
CREATE INDEX `ix_auditoria_log_creado_en` ON `auditoria_log` (`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_moderacion_caso_tipo` ON `moderacion_caso` (`tipo`);--> statement-breakpoint
CREATE INDEX `ix_moderacion_caso_estado` ON `moderacion_caso` (`estado`);