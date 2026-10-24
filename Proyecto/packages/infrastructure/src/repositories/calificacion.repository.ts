import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  CalificacionError,
  type Calificacion,
  type CalificacionRepository,
  type RegistrarCalificacionDto,
  type ResumenCalificacionProveedor
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { calificacion } from "../db/schema/calificacion.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";

const ER_DUP_ENTRY = 1062;
const ER_CHECK_CONSTRAINT_VIOLATED = 3819;

// drizzle-orm >= 0.44 envuelve el error de mysql2 en DrizzleQueryError.cause.
function errnoDe(err: unknown): number | undefined {
  const e = err as { errno?: number; cause?: { errno?: number } };
  return e.cause?.errno ?? e.errno;
}

// Implementacion Drizzle + MySQL del puerto CalificacionRepository (KAN-142).
// El promedio por proveedor se calcula en cada consulta (no hay columnas
// agregadas en organizacion): ver la nota de Table calificacion en
// DataBase/dbDiagram.sql.
export class DrizzleCalificacionRepository implements CalificacionRepository {
  constructor(private readonly db: DbClient) {}

  async registrar(input: RegistrarCalificacionDto): Promise<Calificacion> {
    // INSERT ... SELECT: la fila solo se inserta si el envio esta entregado
    // y el usuario es de la organizacion compradora. Asi la regla vale
    // aunque dos requests lleguen a la vez (no hay SELECT previo que pueda
    // quedar desactualizado); la unicidad por envio la pone el UNIQUE.
    let resultado: ResultSetHeader;
    try {
      [resultado] = await this.db.execute<ResultSetHeader>(sql`
        INSERT INTO calificacion (orden_envio_id, usuario_id, puntaje, comentario)
        SELECT oe.id, u.id, ${input.puntaje}, ${input.comentario ?? null}
        FROM orden_envio oe
        JOIN orden o ON o.id = oe.orden_id
        JOIN usuario u ON u.id = ${input.usuarioId} AND u.organizacion_id = o.organizacion_id
        WHERE oe.id = ${input.ordenEnvioId} AND oe.estado = 'entregado'
      `);
    } catch (err) {
      if (errnoDe(err) === ER_DUP_ENTRY) throw new CalificacionError("ya_calificado");
      if (errnoDe(err) === ER_CHECK_CONSTRAINT_VIOLATED) throw new CalificacionError("puntaje_invalido");
      throw err;
    }
    if (resultado.affectedRows === 0) throw new CalificacionError("envio_no_calificable");

    const [fila] = await this.db.select().from(calificacion).where(eq(calificacion.id, resultado.insertId));
    return fila!;
  }

  async resumenPorProveedor(proveedorIds?: number[]): Promise<ResumenCalificacionProveedor[]> {
    if (proveedorIds && proveedorIds.length === 0) return [];

    // Entra por ix_orden_envio_proveedor_estado (filtro por proveedor) y
    // busca la calificacion de cada envio por ux_calificacion_orden_envio.
    const filas = await this.db
      .select({
        proveedorId: ordenEnvio.proveedorId,
        promedio: sql<string>`AVG(${calificacion.puntaje})`,
        cantidad: count()
      })
      .from(calificacion)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, calificacion.ordenEnvioId))
      .where(proveedorIds ? inArray(ordenEnvio.proveedorId, proveedorIds) : undefined)
      .groupBy(ordenEnvio.proveedorId);

    const porProveedor = new Map(
      filas.map((f) => [
        f.proveedorId,
        { proveedorId: f.proveedorId, promedio: Math.round(Number(f.promedio) * 100) / 100, cantidad: f.cantidad }
      ])
    );
    if (!proveedorIds) return [...porProveedor.values()];
    return proveedorIds.map((id) => porProveedor.get(id) ?? { proveedorId: id, promedio: null, cantidad: 0 });
  }

  async listarPorProveedor(proveedorId: number, limite = 20): Promise<Calificacion[]> {
    const filas = await this.db
      .select({ calificacion })
      .from(calificacion)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, calificacion.ordenEnvioId))
      .where(eq(ordenEnvio.proveedorId, proveedorId))
      .orderBy(desc(calificacion.creadaEn), desc(calificacion.id))
      .limit(limite);
    return filas.map((f) => f.calificacion);
  }
}
