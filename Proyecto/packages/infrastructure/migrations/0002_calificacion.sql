CREATE TABLE `calificacion` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orden_envio_id` bigint NOT NULL,
	`usuario_id` bigint NOT NULL,
	`puntaje` tinyint unsigned NOT NULL,
	`comentario` varchar(500),
	`creada_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `calificacion_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_calificacion_orden_envio` UNIQUE(`orden_envio_id`),
	CONSTRAINT `ck_calificacion_puntaje` CHECK(`calificacion`.`puntaje` BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_orden_envio_id_orden_envio_id_fk` FOREIGN KEY (`orden_envio_id`) REFERENCES `orden_envio`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_usuario_id_usuario_id_fk` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE no action ON UPDATE no action;