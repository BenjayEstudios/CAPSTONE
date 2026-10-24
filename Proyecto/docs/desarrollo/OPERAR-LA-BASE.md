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

- **Nunca `drizzle-kit push`.** Las migraciones `0003` y `0004` tienen DDL a
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
