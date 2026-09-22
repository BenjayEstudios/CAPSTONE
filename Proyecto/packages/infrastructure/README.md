# @cotizapp/infrastructure

Implementación real de las interfaces de repositorio definidas en
`@cotizapp/domain`, usando Drizzle ORM + MySQL (driver `mysql2`).

## Estructura

```
src/
├── db/
│   ├── client.ts        # createDbClient(): pool de mysql2 + instancia de drizzle
│   └── schema/            # tablas de Drizzle (mysqlTable), una por entidad
├── repositories/           # implementaciones concretas (Drizzle) de las
│                            interfaces de @cotizapp/domain/repositories
drizzle.config.ts            # config de drizzle-kit (schema, migraciones, dialecto mysql)
migrations/                   # migraciones SQL generadas por drizzle-kit
```

El schema debe traducir el modelo de `../../DataBase/dbDiagram.sql`
(organizacion, usuario, producto, oferta, carro, orden, liquidacion, etc.) —
todavía no implementado.

## Comandos

```bash
cp .env.example .env
pnpm db:generate   # genera una migración a partir de cambios en db/schema
pnpm db:migrate    # aplica migraciones pendientes contra DATABASE_URL
```

## Regla de dependencia

Depende de `@cotizapp/domain` (implementa sus interfaces). `domain` nunca
depende de este paquete.
