CREATE TABLE `categoria` (
	`id` smallint AUTO_INCREMENT NOT NULL,
	`padre_id` smallint,
	`nombre` varchar(80) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`orden` smallint,
	`estado` enum('activa','oculta') NOT NULL DEFAULT 'activa',
	CONSTRAINT `categoria_id` PRIMARY KEY(`id`),
	CONSTRAINT `categoria_slug_unique` UNIQUE(`slug`)
);
