# @cotizapp/infrastructure

Implementación real de las interfaces de repositorio definidas en
`@cotizapp/domain`, usando Drizzle ORM + MySQL (driver `mysql2`).

## Estructura

```
src/
├── db/
│   ├── client.ts        # createDbClient(): pool de mysql2 + instancia de drizzle
│   ├── schema/            # tablas de Drizzle (mysqlTable), una por entidad
│   └── seed/              # datos de prueba (pnpm db:seed)
├── repositories/           # implementaciones concretas (Drizzle) de las
│                            interfaces de @cotizapp/domain/repositories
drizzle.config.ts            # config de drizzle-kit (schema, migraciones, dialecto mysql)
migrations/                   # migraciones SQL generadas por drizzle-kit
```

El schema traduce 1:1 el modelo de `../../DataBase/dbDiagram.sql`
(organizacion, usuario, producto, oferta, carro, orden, liquidacion, etc.).

## Comandos

```bash
cp .env.example .env
pnpm db:generate   # genera una migración a partir de cambios en db/schema
pnpm db:migrate    # aplica migraciones pendientes contra DATABASE_URL
pnpm db:seed       # VACÍA todas las tablas y carga datos de prueba
```

## Datos de prueba (`db:seed`)

`src/db/seed/` carga un escenario coherente para desarrollar y hacer demos:
7 organizaciones (Cotizapp interna, 4 proveedores — uno en revisión — y 2
clientes), 9 usuarios, 17 productos en 15 categorías, 34 ofertas (cada
producto con 1-3 proveedores a precios distintos, para el comparador), 2
órdenes multiproveedor con sus envíos, líneas, liquidaciones y DTE, más
cobertura, documentos, analítica, auditoría y casos de moderación. Los IDs
son fijos, así que se pueden referenciar desde los frontends.

Todos los usuarios comparten la clave `Cotizapp.2026` (constante
`CLAVE_PRUEBA` en `src/db/seed/seed.ts`). Correos:

| Usuario | Rol | Organización |
|---|---|---|
| admin@cotizapp.test | admin_general | Cotizapp |
| catalogo@cotizapp.test | editor_catalogo | Cotizapp |
| soporte@cotizapp.test | soporte | Cotizapp |
| ventas@losandes.test | proveedor | Los Andes Food Service |
| pedidos@vallecentral.test | proveedor | Valle Central Mayorista |
| comercial@frigosur.test | proveedor | FrigoSur |
| contacto@laspalmas.test | proveedor (invitado) | Las Palmas (en revisión) |
| compras@elfogon.test | comprador | Restaurante El Fogón |
| compras@dulcehogar.test | comprador | Pastelería Dulce Hogar |

Igual que `drizzle.config.ts`, usa `DATABASE_URL` del entorno y, si no está
definida, el MySQL local del `docker-compose.yml`. Si el host no es local
(p. ej. Aiven) se niega a correr salvo que se pase `--allow-remote`
(`pnpm db:seed -- --allow-remote`), porque borra todo lo que haya.

## Regla de dependencia

Depende de `@cotizapp/domain` (implementa sus interfaces). `domain` nunca
depende de este paquete.
