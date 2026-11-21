-- KAN-140: recupera lo que la consolidacion en 0000_schema_inicial dejo
-- fuera: CHECK de destino en orden_envio, FULLTEXT de producto.nombre y
-- particionado mensual de evento_analitico. Generada con drizzle-kit y
-- ajustada a mano (ver comentarios "A mano"). Probada con
-- sql_require_primary_key = 1, como en Aiven.
ALTER TABLE `orden_envio` ADD CONSTRAINT `ck_orden_envio_destino` CHECK ((`orden_envio`.`modalidad` = 'retiro' AND `orden_envio`.`punto_retiro_id` IS NOT NULL AND `orden_envio`.`direccion_entrega_id` IS NULL)
        OR (`orden_envio`.`modalidad` = 'despacho' AND `orden_envio`.`direccion_entrega_id` IS NOT NULL AND `orden_envio`.`punto_retiro_id` IS NULL));
--> statement-breakpoint
-- A mano: drizzle-kit no genera indices FULLTEXT. La collation
-- utf8mb4_0900_ai_ci hace la busqueda insensible a tildes y mayusculas.
ALTER TABLE `producto` ADD FULLTEXT INDEX `ix_producto_nombre_fulltext` (`nombre`);
--> statement-breakpoint
-- evento_analitico: InnoDB no admite FKs en tablas particionadas y exige la
-- columna de particion en toda PK/UNIQUE.
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_producto_id_producto_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_oferta_id_oferta_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_usuario_id_usuario_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_comuna_id_comuna_id_fk`;
--> statement-breakpoint
-- A mano: MySQL deja el indice implicito de cada FK borrada. producto_id y
-- oferta_id ya tienen sus *_idx; estos dos no los usa ninguna consulta y
-- drizzle-kit no los conoce, asi que se borran para que la base quede igual
-- al schema.
ALTER TABLE `evento_analitico` DROP INDEX `evento_analitico_usuario_id_usuario_id_fk`, DROP INDEX `evento_analitico_comuna_id_comuna_id_fk`;
--> statement-breakpoint
-- A mano: drizzle-kit lo genera en dos sentencias, pero DROP PRIMARY KEY
-- solo falla (1075) porque id es AUTO_INCREMENT; y con
-- sql_require_primary_key = 1 (Aiven) la tabla nunca puede quedar sin PK.
ALTER TABLE `evento_analitico` DROP PRIMARY KEY, ADD PRIMARY KEY(`id`,`creado_en`);
--> statement-breakpoint
-- A mano: drizzle-kit no sabe declarar particiones. Una por mes (pAAAAMM
-- guarda ese mes) + pmax de resguardo, para que un insert nunca falle si
-- nadie creo el mes siguiente. `pnpm db:particiones` parte pmax en los meses
-- que vienen; correrlo una vez al mes.
ALTER TABLE `evento_analitico` PARTITION BY RANGE COLUMNS(`creado_en`) (
	PARTITION `p_anterior` VALUES LESS THAN ('2026-09-01'),
	PARTITION `p202609` VALUES LESS THAN ('2026-10-01'),
	PARTITION `p202610` VALUES LESS THAN ('2026-11-01'),
	PARTITION `p202611` VALUES LESS THAN ('2026-12-01'),
	PARTITION `p202612` VALUES LESS THAN ('2027-01-01'),
	PARTITION `p202701` VALUES LESS THAN ('2027-02-01'),
	PARTITION `p202702` VALUES LESS THAN ('2027-03-01'),
	PARTITION `pmax` VALUES LESS THAN (MAXVALUE)
);
