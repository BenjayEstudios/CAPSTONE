CREATE INDEX `organizacion_razon_social_idx` ON `organizacion` (`razon_social`);--> statement-breakpoint
CREATE INDEX `usuario_nombre_idx` ON `usuario` (`nombre`);--> statement-breakpoint
-- FULLTEXT: Drizzle no los modela (drizzle-kit no los detecta ni los elimina). Los usan la
-- busqueda del listado de usuarios y el selector de organizaciones (MATCH ... AGAINST en modo booleano).
CREATE FULLTEXT INDEX `usuario_busqueda_ft` ON `usuario` (`nombre`, `email`);--> statement-breakpoint
CREATE FULLTEXT INDEX `organizacion_busqueda_ft` ON `organizacion` (`razon_social`, `nombre_fantasia`);
