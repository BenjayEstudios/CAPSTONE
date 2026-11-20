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
│   └── particiones/       # mantenimiento de particiones (pnpm db:particiones)
├── repositories/           # implementaciones concretas (Drizzle) de las
│                            interfaces de @cotizapp/domain/repositories
test/                         # tests de integración (vitest) contra el seed local
docs/                         # CONSULTAS_ANALITICA.md (planes con EXPLAIN) + volumen.sql
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
pnpm db:particiones  # crea las particiones mensuales de evento_analitico que falten
```

**No usar `drizzle-kit push`**: hay DDL que drizzle-kit no conoce y que
`push` borraría al comparar el schema contra la base — el FULLTEXT de
`producto.nombre` (migración 0003) y las particiones de `evento_analitico`
(0004), ambos escritos a mano en la migración. `generate` no los toca.

### Particiones de `evento_analitico`

Particionada por mes en `creado_en` (`pAAAAMM` + `pmax` de resguardo).
`pnpm db:particiones` parte `pmax` para que existan las particiones del mes
actual y los 3 siguientes (`pnpm db:particiones -- --meses 6` para otro
horizonte). Es idempotente y no borra datos; hay que correrlo una vez al
mes contra cada base. Si nadie lo corre no se pierde nada: los eventos caen
en `pmax`, solo se deja de ganar el pruning por mes. Por ser particionada,
la tabla no tiene FKs (ver `DataBase/dbDiagram.sql`).

## Datos de prueba (`db:seed`)

`src/db/seed/` carga un escenario coherente para desarrollar y hacer demos:
7 organizaciones (Cotizapp interna, 4 proveedores — uno en revisión — y 2
clientes), 9 usuarios, 17 productos en 15 categorías, 34 ofertas (cada
producto con 1-3 proveedores a precios distintos, para el comparador), 11
órdenes multiproveedor (septiembre-octubre 2026: 9 entregadas, 1 en
preparación, 1 recién pagada) con sus envíos, líneas, cortes de liquidación
semanales y DTE, 16 calificaciones de envíos entregados (Los Andes 4,67 · 6,
FrigoSur 4,40 · 5, Valle Central 3,80 · 5; los dos envíos de CM-10010 quedan
sin calificar), más cobertura, documentos, auditoría y casos de moderación, más ~2.000 eventos
de analítica sintéticos (1-sep al 22-oct, semilla fija: siempre salen
iguales). Los IDs son fijos, así que se pueden referenciar desde los
frontends (las órdenes 1 y 2 conservan los de la versión anterior).

Los montos son coherentes entre sí: el subtotal de cada envío es la suma de
sus líneas, el despacho es 0 si es retiro o si supera el umbral de despacho
gratis del proveedor (si no, la tarifa RM de `proveedor_cobertura`), y cada
liquidación suma lo entregado por ese proveedor en su semana (lun-dom, en
UTC como guarda Drizzle los `datetime`).

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

## Repositorios

- `DrizzleCategoriaRepository`: ejemplo de referencia.
- `DrizzleCalificacionRepository` (KAN-142): registrar una calificación,
  promedio/cantidad por proveedor para el comparador, últimas reseñas.
- `DrizzleAnaliticaRepository` (KAN-143): ventas por semana y por producto
  y embudo vista → click → conversión del panel proveedor; KPIs y búsquedas
  sin resultados del panel admin. Planes de ejecución revisados con EXPLAIN
  en [`docs/CONSULTAS_ANALITICA.md`](docs/CONSULTAS_ANALITICA.md).

Si escribes SQL a mano con `` sql`...` `` y le pasas un `Date`, conviértelo
antes a texto UTC: mysql2 lo formatea en hora local y Drizzle guarda los
`datetime` en UTC (ver `analitica.repository.ts`). Para leer filas de un
SELECT crudo usa `consultar<T>(db, sql)` de `src/db/client.ts`.

## Tests (`pnpm test`)

`test/` tiene tests de integración de los repositorios contra el MySQL
local **con el seed cargado** (`pnpm db:migrate && pnpm db:seed`). Cada test
corre en una transacción que se revierte, así que no ensucian los datos.
Se niegan a correr contra un host que no sea local. En CI (`CI` definida)
no hay MySQL: si la base no responde, la suite se salta; en local, falla
diciendo por qué. `check-types` también revisa `test/` (`test/tsconfig.json`).

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
