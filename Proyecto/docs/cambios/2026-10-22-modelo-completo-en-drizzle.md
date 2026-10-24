# Modelo DBML completo traducido a Drizzle

**Fecha:** 2026-10-22 · **Épica:** KAN-88 · **Ticket:** KAN-139

Se tradujeron las 20 tablas restantes de `DataBase/dbDiagram.sql` a schema
de Drizzle (`packages/infrastructure/src/db/schema/<tabla>.schema.ts`),
siguiendo el patrón de `categoria`. Se generó y aplicó la migración
`0001_tense_next_avengers.sql` contra el MySQL local: las 21 tablas existen
con todas sus FKs e índices.

Lo no obvio: la referencia circular `usuario.rol_id` ↔
`rol.permisos_actualizado_por`. Se resuelve con un import circular entre los
dos schemas y la anotación `(): AnyMySqlColumn => ...` en `rol`, porque
TypeScript no infiere el tipo solo con el callback lazy en un ciclo.

**Por qué**: con el modelo completo cualquiera del equipo puede escribir
repositorios y casos de uso contra tablas reales en vez de mockear.

**Toca**: `packages/infrastructure/src/db/schema/*.ts` (20 nuevos +
`index.ts`), `packages/infrastructure/migrations/0001_*.sql` + `meta/`,
`docs/ARCHITECTURE.md`.
