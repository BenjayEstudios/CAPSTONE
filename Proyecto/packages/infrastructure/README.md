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

## Seed (`db:seed`)

Crea, de forma idempotente, la organizacion `interna`, el rol `administrador`
(`es_sistema=1`, todos los permisos del catalogo en nivel `total`) y un usuario
administrador. Las credenciales NO viven en el repo; se pasan por entorno:

| Variable | Obligatoria | Descripcion |
| --- | --- | --- |
| `SEED_ADMIN_EMAIL` | si | Email del administrador |
| `SEED_ADMIN_PASSWORD` | si | Clave (se guarda con bcrypt) |
| `SEED_ADMIN_NOMBRE` | no | Nombre (por defecto `Administrador`) |
| `DATABASE_URL` | si | Conexion MySQL |

Si falta alguna obligatoria el script termina con codigo 1 sin crear nada.
Si el usuario ya existe no se modifica. Ejemplo (desde `packages/infrastructure`):

```bash
SEED_ADMIN_EMAIL=admin@ejemplo.cl SEED_ADMIN_PASSWORD='<clave>' pnpm db:seed
```
