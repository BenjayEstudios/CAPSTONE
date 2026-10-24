DROP INDEX `ix_producto_nombre` ON `producto`;--> statement-breakpoint
ALTER TABLE `orden_envio` ADD CONSTRAINT `ck_orden_envio_destino` CHECK ((`orden_envio`.`modalidad` = 'retiro' AND `orden_envio`.`punto_retiro_id` IS NOT NULL AND `orden_envio`.`direccion_entrega_id` IS NULL)
        OR (`orden_envio`.`modalidad` = 'despacho' AND `orden_envio`.`direccion_entrega_id` IS NOT NULL AND `orden_envio`.`punto_retiro_id` IS NULL));--> statement-breakpoint
-- Agregado a mano (KAN-140): drizzle-kit no genera indices FULLTEXT. Reemplaza
-- al BTREE ix_producto_nombre de arriba, que era el placeholder del DBML.
-- Parser por defecto: la collation utf8mb4_0900_ai_ci de la columna hace la
-- busqueda insensible a tildes y mayusculas ("azucar" encuentra "Azúcar").
ALTER TABLE `producto` ADD FULLTEXT INDEX `ix_producto_nombre_fulltext` (`nombre`);
