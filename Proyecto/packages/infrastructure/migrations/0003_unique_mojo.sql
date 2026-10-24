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
	`requiere_factura` tinyint NOT NULL DEFAULT 0,
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
	CONSTRAINT `documento_tributario_folio_uq` UNIQUE(`tipo_dte`,`folio`,`emisor_rut`)
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
	`convirtio` tinyint,
	`termino` varchar(160),
	`resultados` smallint unsigned,
	`detalle` json,
	`creado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `evento_analitico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `carro` ADD CONSTRAINT `carro_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_organizacion_id_organizacion_id_fk` FOREIGN KEY (`organizacion_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden` ADD CONSTRAINT `orden_direccion_entrega_id_direccion_id_fk` FOREIGN KEY (`direccion_entrega_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `liquidacion` ADD CONSTRAINT `liquidacion_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_orden_id_orden_id_fk` FOREIGN KEY (`orden_id`) REFERENCES `orden`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_punto_retiro_id_punto_retiro_id_fk` FOREIGN KEY (`punto_retiro_id`) REFERENCES `punto_retiro`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_direccion_entrega_id_direccion_id_fk` FOREIGN KEY (`direccion_entrega_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `orden_envio_liquidacion_id_liquidacion_id_fk` FOREIGN KEY (`liquidacion_id`) REFERENCES `liquidacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_orden_envio_id_orden_envio_id_fk` FOREIGN KEY (`orden_envio_id`) REFERENCES `orden_envio`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orden_linea` ADD CONSTRAINT `orden_linea_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documento_tributario` ADD CONSTRAINT `documento_tributario_orden_id_orden_id_fk` FOREIGN KEY (`orden_id`) REFERENCES `orden`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documento_tributario` ADD CONSTRAINT `documento_tributario_orden_envio_id_orden_envio_id_fk` FOREIGN KEY (`orden_envio_id`) REFERENCES `orden_envio`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_producto_id_producto_id_fk` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_oferta_id_oferta_id_fk` FOREIGN KEY (`oferta_id`) REFERENCES `oferta`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evento_analitico` ADD CONSTRAINT `evento_analitico_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `carro_estado_idx` ON `carro` (`estado`);--> statement-breakpoint
CREATE INDEX `orden_estado_idx` ON `orden` (`estado`);--> statement-breakpoint
CREATE INDEX `orden_estado_pago_idx` ON `orden` (`estado_pago`);--> statement-breakpoint
CREATE INDEX `liquidacion_estado_idx` ON `liquidacion` (`estado`);--> statement-breakpoint
CREATE INDEX `orden_envio_proveedor_estado_idx` ON `orden_envio` (`proveedor_id`,`estado`);--> statement-breakpoint
CREATE INDEX `documento_tributario_tipo_dte_idx` ON `documento_tributario` (`tipo_dte`);--> statement-breakpoint
CREATE INDEX `documento_tributario_estado_sii_idx` ON `documento_tributario` (`estado_sii`);--> statement-breakpoint
CREATE INDEX `evento_analitico_tipo_evento_idx` ON `evento_analitico` (`tipo_evento`);--> statement-breakpoint
CREATE INDEX `evento_analitico_sesion_id_idx` ON `evento_analitico` (`sesion_id`);--> statement-breakpoint
CREATE INDEX `evento_analitico_creado_en_idx` ON `evento_analitico` (`creado_en`);--> statement-breakpoint
CREATE INDEX `evento_analitico_producto_id_idx` ON `evento_analitico` (`producto_id`);--> statement-breakpoint
CREATE INDEX `evento_analitico_oferta_id_idx` ON `evento_analitico` (`oferta_id`);