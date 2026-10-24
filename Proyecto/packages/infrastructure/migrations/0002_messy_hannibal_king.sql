CREATE TABLE `proveedor_documento` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`tipo` enum('carpeta_tributaria','resolucion_sanitaria','vigencia') NOT NULL,
	`url` varchar(300) NOT NULL,
	`vence_en` date,
	`estado` enum('al_dia','por_vencer','vencido') NOT NULL DEFAULT 'al_dia',
	`revision_estado` enum('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
	`revisado_por` bigint,
	`revisado_en` datetime,
	`motivo_rechazo` varchar(240),
	CONSTRAINT `proveedor_documento_id` PRIMARY KEY(`id`)
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
	CONSTRAINT `proveedor_cobertura_prov_region_comuna_uq` UNIQUE(`proveedor_id`,`region_codigo`,`comuna_id`)
);
--> statement-breakpoint
CREATE TABLE `punto_retiro` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`proveedor_id` bigint NOT NULL,
	`direccion_id` bigint NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`horario` varchar(180),
	`activo` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `punto_retiro_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `proveedor_documento` ADD CONSTRAINT `proveedor_documento_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_documento` ADD CONSTRAINT `proveedor_documento_revisado_por_usuario_id_fk` FOREIGN KEY (`revisado_por`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_cobertura` ADD CONSTRAINT `proveedor_cobertura_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proveedor_cobertura` ADD CONSTRAINT `proveedor_cobertura_comuna_id_comuna_id_fk` FOREIGN KEY (`comuna_id`) REFERENCES `comuna`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `punto_retiro` ADD CONSTRAINT `punto_retiro_proveedor_id_organizacion_id_fk` FOREIGN KEY (`proveedor_id`) REFERENCES `organizacion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `punto_retiro` ADD CONSTRAINT `punto_retiro_direccion_id_direccion_id_fk` FOREIGN KEY (`direccion_id`) REFERENCES `direccion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `proveedor_documento_vence_en_idx` ON `proveedor_documento` (`vence_en`);