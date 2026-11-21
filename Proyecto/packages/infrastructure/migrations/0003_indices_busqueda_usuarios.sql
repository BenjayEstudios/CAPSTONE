-- Indices de busqueda del listado de usuarios y del selector de organizaciones
-- (rama dev-sebamax). Nacio como 0001_indices_busqueda_usuarios; al integrarla
-- con main (que ya tenia 0001_kan140_* y 0002_usuario_mfa_secreto) se renumero
-- a 0003 con un "when" nuevo en meta/_journal.json: el migrador de Drizzle solo
-- aplica migraciones con "when" mayor que la ultima aplicada, asi que con el
-- "when" original se habria saltado en las bases que ya tienen la 0002.
CREATE INDEX `organizacion_razon_social_idx` ON `organizacion` (`razon_social`);--> statement-breakpoint
CREATE INDEX `usuario_nombre_idx` ON `usuario` (`nombre`);--> statement-breakpoint
-- FULLTEXT: Drizzle no los modela (drizzle-kit no los detecta ni los elimina). Los usan la
-- busqueda del listado de usuarios y el selector de organizaciones (MATCH ... AGAINST en modo booleano).
CREATE FULLTEXT INDEX `usuario_busqueda_ft` ON `usuario` (`nombre`, `email`);--> statement-breakpoint
CREATE FULLTEXT INDEX `organizacion_busqueda_ft` ON `organizacion` (`razon_social`, `nombre_fantasia`);
