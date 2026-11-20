import { asc } from "drizzle-orm";
import type { ComunaConRegion, ComunaRepository } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { comuna } from "../db/schema/comuna.schema.js";

export class DrizzleComunaRepository implements ComunaRepository {
  constructor(private readonly db: DbClient) {}

  async listar(): Promise<ComunaConRegion[]> {
    return this.db
      .select({ id: comuna.id, nombre: comuna.nombre, regionCodigo: comuna.regionCodigo, regionNombre: comuna.regionNombre })
      .from(comuna)
      .orderBy(asc(comuna.regionOrden), asc(comuna.nombre));
  }
}
