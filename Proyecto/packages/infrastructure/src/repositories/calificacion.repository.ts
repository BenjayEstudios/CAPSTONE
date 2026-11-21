import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";
import {
  CalificacionError,
  type Calificacion,
  type CalificacionRecibida,
  type CalificacionRepository,
  type ResumenCalificacionesRecibidas,
  type RegistrarCalificacionDto,
  type ResumenCalificacionProveedor
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { calificacion } from "../db/schema/calificacion.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";

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

  async resumenRecibidas(proveedorId: number): Promise<ResumenCalificacionesRecibidas> {
    const filas = await this.db
      .select({ puntaje: calificacion.puntaje, n: count() })
      .from(calificacion)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, calificacion.ordenEnvioId))
      .where(eq(ordenEnvio.proveedorId, proveedorId))
      .groupBy(calificacion.puntaje);
    const distribucion = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } as ResumenCalificacionesRecibidas["distribucion"];
    let cantidad = 0;
    let suma = 0;
    for (const f of filas) {
      if (f.puntaje >= 1 && f.puntaje <= 5) distribucion[String(f.puntaje) as keyof typeof distribucion] = f.n;
      cantidad += f.n;
      suma += f.puntaje * f.n;
    }
    return { promedio: cantidad ? Math.round((suma / cantidad) * 100) / 100 : null, cantidad, distribucion };
  }

  async listarRecibidas(proveedorId: number, p: { pagina: number; tamano: number }): Promise<{ items: CalificacionRecibida[]; total: number }> {
    const filtro = eq(ordenEnvio.proveedorId, proveedorId);
    const [totalFila] = await this.db
      .select({ total: count() })
      .from(calificacion)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, calificacion.ordenEnvioId))
      .where(filtro);
    const filas = await this.db
      .select({
        id: calificacion.id,
        ordenEnvioId: calificacion.ordenEnvioId,
        ordenCodigo: orden.codigo,
        razonSocial: organizacion.razonSocial,
        nombreFantasia: organizacion.nombreFantasia,
        puntaje: calificacion.puntaje,
        comentario: calificacion.comentario,
        creadaEn: calificacion.creadaEn
      })
      .from(calificacion)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, calificacion.ordenEnvioId))
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .innerJoin(organizacion, eq(organizacion.id, orden.organizacionId))
      .where(filtro)
      .orderBy(desc(calificacion.creadaEn), desc(calificacion.id))
      .limit(p.tamano)
      .offset((p.pagina - 1) * p.tamano);
    return {
      total: totalFila?.total ?? 0,
      items: filas.map((f) => ({
        id: f.id,
        ordenEnvioId: f.ordenEnvioId,
        ordenCodigo: f.ordenCodigo,
        cliente: f.nombreFantasia ?? f.razonSocial,
        puntaje: f.puntaje,
        comentario: f.comentario,
        creadaEn: f.creadaEn
      }))
    };
  }
}
