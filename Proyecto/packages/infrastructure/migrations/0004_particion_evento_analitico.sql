-- KAN-140: particionamiento mensual de evento_analitico por creado_en.
-- Generada con drizzle-kit y ajustada a mano (ver comentarios). InnoDB no
-- admite foreign keys en tablas particionadas y exige que la columna de
-- particion este en toda PK/UNIQUE: se quitan las 4 FKs y la PK pasa a
-- (id, creado_en). Decision documentada en DataBase/dbDiagram.sql.
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_producto_id_producto_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_oferta_id_oferta_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_usuario_id_usuario_id_fk`;
--> statement-breakpoint
ALTER TABLE `evento_analitico` DROP FOREIGN KEY `evento_analitico_comuna_id_comuna_id_fk`;
--> statement-breakpoint
-- A mano: MySQL crea un indice implicito por cada FK y lo deja al borrarla.
-- producto_id y oferta_id ya tienen ix_ propios; estos dos no los usa ninguna
-- consulta y drizzle-kit no los conoce, asi que se borran para que la base
-- quede igual al schema.
ALTER TABLE `evento_analitico` DROP INDEX `evento_analitico_usuario_id_usuario_id_fk`, DROP INDEX `evento_analitico_comuna_id_comuna_id_fk`;
--> statement-breakpoint
-- A mano: drizzle-kit lo genera como dos sentencias, pero DROP PRIMARY KEY
-- solo falla (1075) porque id es AUTO_INCREMENT y debe seguir indexado.
ALTER TABLE `evento_analitico` DROP PRIMARY KEY, ADD PRIMARY KEY(`id`,`creado_en`);
--> statement-breakpoint
-- A mano: drizzle-kit no sabe declarar particiones. Una por mes (pAAAAMM
-- guarda ese mes) + pmax de resguardo, para que un insert nunca falle si
-- nadie creo el mes siguiente. `pnpm db:particiones` parte pmax en los
-- meses que vienen; correrlo una vez al mes.
ALTER TABLE `evento_analitico` PARTITION BY RANGE COLUMNS(`creado_en`) (
	PARTITION `p_anterior` VALUES LESS THAN ('2026-09-01'),
	PARTITION `p202609` VALUES LESS THAN ('2026-10-01'),
	PARTITION `p202610` VALUES LESS THAN ('2026-11-01'),
	PARTITION `p202611` VALUES LESS THAN ('2026-12-01'),
	PARTITION `p202612` VALUES LESS THAN ('2027-01-01'),
	PARTITION `pmax` VALUES LESS THAN (MAXVALUE)
);
