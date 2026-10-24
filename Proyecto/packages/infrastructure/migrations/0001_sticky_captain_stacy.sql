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
	`ofrece_despacho` tinyint,
	`ofrece_retiro` tinyint,
	`entregas_a_tiempo_pct` decimal(5,2),
	`banco` varchar(60),
	`cuenta_bancaria` varchar(40),
	`creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `organizacion_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizacion_rut_unique` UNIQUE(`rut`)
);
--> statement-breakpoint
CREATE TABLE `rol` (
	`id` smallint AUTO_INCREMENT NOT NULL,
	`codigo` varchar(40) NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`descripcion` varchar(240),
	`es_sistema` tinyint NOT NULL DEFAULT 0,
	`permisos` json NOT NULL,
	`permisos_actualizado_por` bigint,
	`permisos_actualizado_en` datetime,
	CONSTRAINT `rol_id` PRIMARY KEY(`id`),
	CONSTRAINT `rol_codigo_unique` UNIQUE(`codigo`)
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
CREATE TABLE `oferta` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`producto_id` bigint NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`precio_unitario` int unsigned NOT NULL,
	`unidades_por_caja` smallint unsigned,
	`cajas_disponibles` int unsigned,
	`cajas_iniciales` int unsigned,
	`minimo_compra` smallint unsigned,
	`plazo_horas` smallint,
	`modalidad_entrega` enum('despacho','retiro','ambos') NOT NULL,
	`notas_cliente` varchar(240),
	`estado` enum('borrador','publicada','pausada') NOT NULL DEFAULT 'borrador',
	`actualizada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `oferta_id` PRIMARY KEY(`id`),
	CONSTRAINT `oferta_producto_proveedor_uq` UNIQUE(`producto_id`,`proveedor_id`)
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
ALTER TABLE `direccion` ADD CONSTRAINT `direccion_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizacion` ADD CONSTRAINT `organizacion_direccion_id_direccion_id_fk` FOREIGN KEY (`direccion_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_organizacion_id_organizacion_id_fk` FOREIGN KEY (`organizacion_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_rol_id_rol_id_fk` FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producto` ADD CONSTRAINT `producto_categoria_id_categoria_id_fk` FOREIGN KEY (`categoria_id`) REFERENCES `categoria`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `producto` ADD CONSTRAINT `producto_creado_por_usuario_id_fk` FOREIGN KEY (`creado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta` ADD CONSTRAINT `oferta_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta` ADD CONSTRAINT `oferta_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta_precio_historial` ADD CONSTRAINT `oferta_precio_historial_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oferta_precio_historial` ADD CONSTRAINT `oferta_precio_historial_cambiado_por_usuario_id_fk` FOREIGN KEY (`cambiado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderacion_caso` ADD CONSTRAINT `moderacion_caso_asignado_a_usuario_id_fk` FOREIGN KEY (`asignado_a`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditoria_log` ADD CONSTRAINT `auditoria_log_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comuna_nombre_idx` ON `comuna` (`nombre`);--> statement-breakpoint
CREATE INDEX `comuna_region_codigo_idx` ON `comuna` (`region_codigo`);--> statement-breakpoint
CREATE INDEX `organizacion_tipo_idx` ON `organizacion` (`tipo`);--> statement-breakpoint
CREATE INDEX `usuario_estado_idx` ON `usuario` (`estado`);--> statement-breakpoint
CREATE INDEX `producto_estado_idx` ON `producto` (`estado`);--> statement-breakpoint
CREATE INDEX `ix_oferta_comparador` ON `oferta` (`producto_id`,`precio_unitario`);--> statement-breakpoint
CREATE INDEX `oferta_estado_idx` ON `oferta` (`estado`);--> statement-breakpoint
CREATE INDEX `oferta_precio_historial_cambiado_en_idx` ON `oferta_precio_historial` (`cambiado_en`);--> statement-breakpoint
CREATE INDEX `moderacion_caso_tipo_idx` ON `moderacion_caso` (`tipo`);--> statement-breakpoint
CREATE INDEX `moderacion_caso_estado_idx` ON `moderacion_caso` (`estado`);--> statement-breakpoint
CREATE INDEX `auditoria_log_entidad_idx` ON `auditoria_log` (`entidad`);--> statement-breakpoint
CREATE INDEX `auditoria_log_creado_en_idx` ON `auditoria_log` (`creado_en`);--> statement-breakpoint
-- Agregado a mano: Drizzle no soporta FULLTEXT (ver DBML, indice ix_producto_nombre_fulltext).
ALTER TABLE `producto` ADD FULLTEXT INDEX `ix_producto_nombre_fulltext` (`nombre`);
