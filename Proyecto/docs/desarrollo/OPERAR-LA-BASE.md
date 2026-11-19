# Operar la base

Comandos de `packages/infrastructure`, desde `Proyecto/` con
`pnpm --filter @cotizapp/infrastructure <comando>` o desde la carpeta del
paquete con `pnpm <comando>`. Usan `DATABASE_URL` del entorno y, si no está,
el MySQL local del `docker-compose.yml`.

| Comando | Qué hace | Cuándo |
|---|---|---|
| `db:generate` | Genera una migración a partir de cambios en `src/db/schema` | Después de tocar un schema |
| `db:migrate` | Aplica las migraciones pendientes | Al clonar, al traer cambios, en cada deploy |
| `db:seed` | **Vacía** todas las tablas y carga los datos de prueba | Para rearmar la base de desarrollo o la demo |
| `db:particiones` | Crea las particiones mensuales de `evento_analitico` que falten | **Una vez al mes**, en cada base |
| `test` | Tests de integración de los repositorios | Con la base local migrada y con el seed |

## Lo que no hay que hacer

- **Nunca `drizzle-kit push`.** La migración `0001` tiene DDL a
  mano que drizzle-kit no conoce (FULLTEXT de `producto.nombre`, particiones
  de `evento_analitico`); `push` lo borraría al comparar. Siempre
  `generate` + `migrate`.
- **No correr `db:seed` contra Aiven** sin estar seguro: es la base
  compartida del equipo y el seed borra todo. Por eso exige
  `-- --allow-remote`.
- **No editar una migración ya aplicada** en otra base. Si hay que corregir
  algo, migración nueva.

## Si hay que escribir DDL a mano

Cuando el schema necesita algo que Drizzle no expresa (otro FULLTEXT, una
partición, un CHECK raro): generar la migración con `db:generate`,
agregarle el SQL a mano con un comentario `-- A mano:` que explique por qué,
y dejar un comentario en el `*.schema.ts` correspondiente que apunte a la
migración. Así quien lea el schema sabe que hay algo que no está ahí.

## Particiones mensuales

`evento_analitico` tiene una partición por mes (`pAAAAMM`) y una `pmax` de
resguardo. `db:particiones` parte `pmax` para que existan el mes actual y
los 3 siguientes (`-- --meses 6` para otro horizonte). Es idempotente y no
borra datos.

Si se olvida, no se pierde nada: los eventos caen en `pmax` y solo se deja
de ganar el pruning por mes. Al momento de escribir esto, la migración deja
creadas hasta `p202612`, así que **antes de enero de 2027** hay que haberlo
corrido. Automatizarlo es una
[decisión abierta](../decisiones/DECISIONES-ABIERTAS.md).

## Rearmar Aiven

Cuando Aiven (base compartida, `defaultdb`) quedó desfasada del repo y no hay
ruta de migración. Caso típico: tiene registradas migraciones que ya no
existen (p. ej. después de consolidar en `0000_schema_inicial`). **Ojo:
`db:migrate` falla en ese caso**: ve la migración nueva como pendiente,
intenta `CREATE TABLE` de tablas que ya existen (`ERROR 1050`) y
`drizzle-kit` solo sale con código 1, sin mostrar el error.

Recrear **borra todo**, así que sigue este orden y no te saltes pasos. Nunca
imprimas ni pegues la `DATABASE_URL` de Aiven: se lee de
`apps/backend/.env`. Aiven tiene `sql_require_primary_key = 1` (el MySQL
local, 0) y, si no resuelve por DNS, es que el servicio está apagado.

**1. Revisar que no haya datos del equipo** (solo lectura): conteos por
tabla contra el seed, ids fuera de rango (`AUTO_INCREMENT` mayor que id
máximo + 1 indica filas borradas), fechas posteriores a la última carga del
seed, usuarios que no sean `@*.test` o con `ultimo_acceso`. Si hay algo que
no es del seed, parar y avisar.

**2. Respaldo**, fuera del repo, con el `mysqldump` del contenedor:

```bash
URL=$(grep -E '^DATABASE_URL=.*aivencloud' apps/backend/.env | head -1 | cut -d= -f2-)
# separar host/puerto/usuario/clave/base de $URL sin imprimirlos, y:
docker exec -e MYSQL_PWD="$CLAVE" cotizapp-mysql mysqldump --ssl-mode=REQUIRED \
  -h"$HOST" -P"$PUERTO" -u"$USUARIO" --single-transaction --set-gtid-purged=OFF \
  --no-tablespaces --routines --triggers --hex-blob defaultdb \
  > ~/backups/cotizapp/aiven-defaultdb-AAAAMMDD-HHMM.sql
tail -1 ~/backups/cotizapp/aiven-defaultdb-*.sql   # debe decir "-- Dump completed"
```

**3. Ensayo local**: restaurar ese respaldo en un schema descartable
(`cotizapp_ensayo`), `SET GLOBAL sql_require_primary_key = 1`, correr el paso
4 contra él con `DATABASE_URL=mysql://cotizapp:cotizapp@localhost:3306/cotizapp_ensayo`,
y al final devolver la variable a su valor y borrar el schema.

**4. Recrear**: vaciar (este SQL borra todas las tablas del schema
conectado, incluida `__drizzle_migrations`), migrar y cargar el seed:

```sql
SET SESSION group_concat_max_len = 1000000;
SET FOREIGN_KEY_CHECKS = 0;
SET @tablas = (SELECT GROUP_CONCAT(CONCAT('`', TABLE_NAME, '`')) FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE');
SET @q = IF(@tablas IS NULL, 'DO 0', CONCAT('DROP TABLE ', @tablas));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
SET FOREIGN_KEY_CHECKS = 1;
```

```bash
cd packages/infrastructure
export DATABASE_URL="$(grep -E '^DATABASE_URL=.*aivencloud' ../../apps/backend/.env | head -1 | cut -d= -f2-)"
pnpm db:migrate
pnpm db:seed -- --allow-remote
unset DATABASE_URL
```

**5. Verificar**: `__drizzle_migrations` con una sola fila cuyo `hash` es el
`sha256sum` de `migrations/0000_schema_inicial.sql`; columnas, índices, FKs y
CHECKs iguales a los de un schema armado solo con la migración (comparar
`information_schema` contra el del ensayo); conteos del seed
([CUENTAS-DE-PRUEBA.md](CUENTAS-DE-PRUEBA.md)); y login de admin contra un
backend local con `DATABASE_URL` apuntando a Aiven. Si algo falla después de
borrar, restaurar el respaldo (`mysql ... defaultdb < respaldo.sql`).

Avisar al equipo antes de empezar: mientras dura, Aiven no responde, y
después los datos son los del seed actual.

La base local se rearma igual (pasos 4 y 5 sin `--allow-remote`), sin
ensayo.

## Tests de repositorios

`packages/infrastructure/test/` corre contra el MySQL local **con el seed
cargado**; cada test va en una transacción que se revierte. Se niegan a
correr contra un host no local. En CI (`CI` definida, sin MySQL) se saltan;
en local, si la base no responde, fallan diciendo por qué.

```bash
cd Proyecto
docker compose up -d mysql
pnpm --filter @cotizapp/infrastructure db:migrate
pnpm --filter @cotizapp/infrastructure db:seed
pnpm --filter @cotizapp/infrastructure test
```
