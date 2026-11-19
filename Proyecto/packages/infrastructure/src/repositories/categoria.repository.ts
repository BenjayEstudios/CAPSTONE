import { count, eq } from "drizzle-orm";
import type {
  ActualizarCategoriaDto,
  Categoria,
  CategoriaRepository,
  CrearCategoriaDto
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { categoria } from "../db/schema/categoria.schema.js";

type CategoriaRow = typeof categoria.$inferSelect;

function toEntity(fila: CategoriaRow): Categoria {
  return {
    id: fila.id,
    padreId: fila.padreId,
    nombre: fila.nombre,
    slug: fila.slug,
    orden: fila.orden,
    estado: fila.estado
  };
}

// Implementacion concreta (Drizzle + MySQL) del puerto CategoriaRepository
// definido en @cotizapp/domain. Es la unica capa que conoce el esquema de
// la tabla y el driver mysql2.
export class DrizzleCategoriaRepository implements CategoriaRepository {
  constructor(private readonly db: DbClient) {}

  async listar(): Promise<Categoria[]> {
    const filas = await this.db.select().from(categoria);
    return filas.map(toEntity);
  }

  async buscarPorId(id: number): Promise<Categoria | null> {
    const [fila] = await this.db.select().from(categoria).where(eq(categoria.id, id)).limit(1);
    return fila ? toEntity(fila) : null;
  }

  async buscarPorSlug(slug: string): Promise<Categoria | null> {
    const [fila] = await this.db.select().from(categoria).where(eq(categoria.slug, slug)).limit(1);
    return fila ? toEntity(fila) : null;
  }

  async contarHijos(id: number): Promise<number> {
    const [fila] = await this.db.select({ n: count() }).from(categoria).where(eq(categoria.padreId, id));
    return Number(fila?.n ?? 0);
  }

  async crear(input: CrearCategoriaDto): Promise<Categoria> {
    const [{ id }] = await this.db
      .insert(categoria)
      .values({
        nombre: input.nombre,
        slug: input.slug,
        padreId: input.padreId ?? null,
        orden: input.orden ?? null
      })
      .$returningId();

    const [fila] = await this.db.select().from(categoria).where(eq(categoria.id, id));
    return toEntity(fila);
  }

  async actualizar(id: number, cambios: ActualizarCategoriaDto): Promise<Categoria> {
    await this.db.update(categoria).set(cambios).where(eq(categoria.id, id));
    const [fila] = await this.db.select().from(categoria).where(eq(categoria.id, id));
    return toEntity(fila);
  }
}
