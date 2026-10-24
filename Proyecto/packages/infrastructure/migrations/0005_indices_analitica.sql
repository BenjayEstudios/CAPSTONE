DROP INDEX `ix_orden_estado_pago` ON `orden`;--> statement-breakpoint
DROP INDEX `ix_evento_analitico_tipo_evento` ON `evento_analitico`;--> statement-breakpoint
DROP INDEX `ix_evento_analitico_producto_id` ON `evento_analitico`;--> statement-breakpoint
DROP INDEX `ix_evento_analitico_oferta_id` ON `evento_analitico`;--> statement-breakpoint
CREATE INDEX `ix_orden_estado_pago` ON `orden` (`estado_pago`,`creada_en`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_tipo_evento` ON `evento_analitico` (`tipo_evento`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_producto_id` ON `evento_analitico` (`producto_id`,`tipo_evento`,`creado_en`);--> statement-breakpoint
CREATE INDEX `ix_evento_analitico_oferta_id` ON `evento_analitico` (`oferta_id`,`creado_en`,`convirtio`);