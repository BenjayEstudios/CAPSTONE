# CRUD, parte 1: capas del backend (`packages/`)

Pasos 1 a 4 de la [guía de CRUD](README.md). Cubre `domain`, `application` e
`infrastructure` para `categoria`. Lo marcado **(existe)** ya está en el
repo; el resto es lo que hay que escribir.

## Paso 1: domain (entidad, error, DTO y puerto)

> **Por qué así:** Domain es el centro y no importa nada de afuera; la interfaz es el puerto que después implementa infrastructure (A, B, D). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

`packages/domain/src/` es TypeScript puro: ni Drizzle, ni Fastify, ni JWT.

**Entidad (existe)** — `entities/categoria.entity.ts`. Se le agrega el error
de dominio para los conflictos, con el mismo patrón que `CalificacionError`
en `calificacion.entity.ts`:

```ts
// Por que no se pudo guardar o borrar una categoria. La ruta HTTP lo
// devuelve como 409.
export type CategoriaErrorCodigo = "slug_duplicado" | "en_uso";

export class CategoriaError extends Error {
  constructor(readonly codigo: CategoriaErrorCodigo) {
    super(`No se pudo guardar la categoria: ${codigo}`);
    this.name = "CategoriaError";
  }
}
```

**DTOs** — `dtos/categoria.dto.ts`. `crearCategoriaSchema` existe; se agrega
el de actualizar. Todos los campos opcionales (es un `PATCH`), pero al menos
uno:

```ts
export const actualizarCategoriaSchema = crearCategoriaSchema
  .extend({ estado: z.enum(["activa", "oculta"]) })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: "No hay nada que actualizar" });

export type ActualizarCategoriaDto = z.infer<typeof actualizarCategoriaSchema>;
```

El schema vive en `domain` para que lo usen la ruta y el caso de uso sin
duplicar reglas. `z.object` descarta las claves que no conoce, así que un
`id` o un `creadoEn` en el body no llegan a la base.

**Puerto** — `repositories/categoria.repository.ts`. Se amplía la interfaz:

```ts
export interface CategoriaRepository {
  listar(): Promise<Categoria[]>;
  obtener(id: number): Promise<Categoria | null>;      // null: no existe
  crear(input: CrearCategoriaDto): Promise<Categoria>;
  actualizar(id: number, input: ActualizarCategoriaDto): Promise<Categoria | null>;
  eliminar(id: number): Promise<boolean>;               // false: no existe
}
```

Convención: "no existe" se devuelve como `null`/`false` (la ruta lo traduce a
404); los conflictos de negocio se lanzan como `CategoriaError` (409).

## Paso 2: application (un caso de uso por operación)

> **Por qué así:** las reglas de negocio reciben el repositorio por parámetro y solo conocen su interfaz, nunca la clase Drizzle (C, D). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

`packages/application/src/use-cases/`. Cada caso de uso es una función que
recibe sus dependencias y devuelve la operación; nada de clases ni
contenedor de DI. Mismo formato que `crear-categoria.use-case.ts` (existe):

```ts
// obtener-categoria.use-case.ts
import type { CategoriaRepository } from "@cotizapp/domain";

export function obtenerCategoria(deps: { categoriaRepository: CategoriaRepository }) {
  return async (id: number) => deps.categoriaRepository.obtener(id);
}
```

```ts
// actualizar-categoria.use-case.ts
import { actualizarCategoriaSchema, type ActualizarCategoriaDto, type CategoriaRepository } from "@cotizapp/domain";

export function actualizarCategoria(deps: { categoriaRepository: CategoriaRepository }) {
  return async (id: number, input: ActualizarCategoriaDto) => {
    const data = actualizarCategoriaSchema.parse(input);
    return deps.categoriaRepository.actualizar(id, data);
  };
}
```

`eliminar-categoria.use-case.ts` igual que `obtener`, llamando a
`eliminar(id)`. Los tres se exportan en `use-cases/index.ts`.

Acá van las **reglas de negocio** que no son "validar formato": por
ejemplo, que `padreId` apunte a una categoría raíz (el árbol es de 2
niveles). Si una regla necesita datos, se pide al repositorio; el caso de
uso nunca hace SQL.

Si el CRUD es de algo que pertenece a una organización (ofertas, puntos de
retiro…), el caso de uso recibe también el `organizacionId` del token y lo
usa para filtrar: un proveedor no puede editar la oferta de otro. Eso es
regla de negocio y va acá, no en la ruta.

## Paso 3: infrastructure (el repositorio Drizzle)

> **Por qué así:** es el adaptador del puerto del paso 1, y el único lugar que sabe que hay MySQL (A, B). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

**Tabla (existe)** — `src/db/schema/categoria.schema.ts`, traducción 1:1 de
`DataBase/dbDiagram.sql`. El modelo completo ya está en Drizzle.

**Repositorio** — `src/repositories/categoria.repository.ts`. Se agregan los
métodos a `DrizzleCategoriaRepository`:

```ts
import { CategoriaError, type ActualizarCategoriaDto /* , ... */ } from "@cotizapp/domain";

const ER_DUP_ENTRY = 1062;            // UNIQUE violado (slug repetido)
const ER_ROW_IS_REFERENCED = 1451;    // FK: hay productos en la categoria

  async obtener(id: number): Promise<Categoria | null> {
    const [fila] = await this.db.select().from(categoria).where(eq(categoria.id, id));
    return fila ? toEntity(fila) : null;
  }

  async actualizar(id: number, input: ActualizarCategoriaDto): Promise<Categoria | null> {
    try {
      await this.db.update(categoria).set(input).where(eq(categoria.id, id));
    } catch (err) {
      if (errnoDe(err) === ER_DUP_ENTRY) throw new CategoriaError("slug_duplicado");
      throw err;
    }
    return this.obtener(id);   // null si el id no existia
  }

  async eliminar(id: number): Promise<boolean> {
    try {
      const [resultado] = await this.db.delete(categoria).where(eq(categoria.id, id));
      return resultado.affectedRows > 0;
    } catch (err) {
      if (errnoDe(err) === ER_ROW_IS_REFERENCED) throw new CategoriaError("en_uso");
      throw err;
    }
  }
```

- `errnoDe` ya existe en `calificacion.repository.ts` (drizzle envuelve el
  error de mysql2 en `.cause`). Al necesitarlo en un segundo repositorio,
  moverlo a `src/db/errores.ts` y que ambos lo importen; no copiarlo.
- `crear` (existe) debería atrapar `ER_DUP_ENTRY` de la misma forma.
- MySQL no tiene `RETURNING`: después de `insert`/`update` se vuelve a leer
  la fila (`$returningId()` + `select`, como en `crear`).
- **¿Borrar o archivar?** Casi todas las tablas del modelo tienen `estado`
  (`categoria`: `activa`/`oculta`; `producto`: `borrador`/`publicado`/`archivado`).
  Lo normal es que "eliminar" en la UI sea un `PATCH` de `estado`, y que el
  `DELETE` real quede para filas sin nada que las referencie. El historial
  (órdenes, calificaciones) nunca se borra.

## Paso 4: test del repositorio

> **Por qué así:** como el adaptador está aislado detrás del puerto, se prueba solo, sin HTTP (B). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

`packages/infrastructure/test/`, contra el MySQL local con el seed. Cada
test corre en una transacción que se revierte, así que se puede crear y
borrar sin ensuciar la base:

```ts
// test/categoria.repository.test.ts
import { expect, it } from "vitest";
import { DrizzleCategoriaRepository } from "../src/repositories/categoria.repository.js";
import { describeDb } from "./db.js";

describeDb("DrizzleCategoriaRepository", (db) => {
  const repo = () => new DrizzleCategoriaRepository(db());

  it("crea, actualiza y elimina", async () => {
    const creada = await repo().crear({ nombre: "Prueba", slug: "prueba-crud" });
    expect((await repo().actualizar(creada.id, { nombre: "Otra" }))?.nombre).toBe("Otra");
    expect(await repo().eliminar(creada.id)).toBe(true);
    expect(await repo().obtener(creada.id)).toBeNull();
  });

  it("devuelve null al actualizar un id que no existe", async () => {
    expect(await repo().actualizar(9999, { nombre: "X" })).toBeNull();
  });
});
```

Para correrlo: `docker compose up -d mysql`, y con la base migrada y con el
seed, `pnpm --filter @cotizapp/infrastructure test`
([OPERAR-LA-BASE.md](../OPERAR-LA-BASE.md#tests-de-repositorios)).

Sigue en [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md).
