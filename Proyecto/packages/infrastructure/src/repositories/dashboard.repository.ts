import { and, asc, count, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import type { DashboardRepository, MuestraSalud, ProductoSalud, RangoMes } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { oferta } from "../db/schema/oferta.schema.js";
import { producto } from "../db/schema/producto.schema.js";

// Solo lectura. Orden contada: estado_pago = 'pagado' y estado <> 'reembolsada';
// se filtra por creada_en. Envios contados: estado <> 'cancelado'.
const contada = (r: RangoMes) =>
  and(eq(orden.estadoPago, "pagado"), ne(orden.estado, "reembolsada"), gte(orden.creadaEn, r.desde), lt(orden.creadaEn, r.hastaExclusivo));
const num = (v: unknown) => Number(v ?? 0);

const sinImagenSql = sql`(${producto.imagenes} IS NULL OR JSON_LENGTH(${producto.imagenes}) = 0)`;
const aSalud = (r: { id: number; nombre: string; ean: string | null; formato: string | null }): ProductoSalud => ({
  id: Number(r.id),
  nombre: r.nombre,
  ean: r.ean,
  formato: r.formato
});

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly db: DbClient) {}

  async totalesMes(r: RangoMes) {
    const [o] = await this.db
      .select({ ordenes: count(), monto: sql<string>`COALESCE(SUM(${orden.total}), 0)` })
      .from(orden)
      .where(contada(r));
    const [e] = await this.db
      .select({
        comision: sql<string>`COALESCE(SUM(${ordenEnvio.comisionMonto}), 0)`,
        proveedores: sql<string>`COUNT(DISTINCT ${ordenEnvio.proveedorId})`
      })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .innerJoin(organizacion, eq(organizacion.id, ordenEnvio.proveedorId))
      .where(and(contada(r), ne(ordenEnvio.estado, "cancelado"), eq(organizacion.estado, "activa")));
    return { ordenes: num(o?.ordenes), monto: num(o?.monto), comision: num(e?.comision), proveedoresActivos: num(e?.proveedores) };
  }

  async montoPorDia(r: RangoMes) {
    const dia = sql<string>`DATE_FORMAT(${orden.creadaEn}, '%Y-%m-%d')`;
    const rows = await this.db
      .select({ fecha: dia, monto: sql<string>`SUM(${orden.total})` })
      .from(orden)
      .where(contada(r))
      .groupBy(dia)
      .orderBy(asc(dia));
    return rows.map((x) => ({ fecha: x.fecha, monto: num(x.monto) }));
  }

  async proveedoresPorVolumen(r: RangoMes, limite: number) {
    const monto = sql<string>`SUM(${ordenEnvio.subtotal})`;
    const rows = await this.db
      .select({
        proveedorId: ordenEnvio.proveedorId,
        nombre: sql<string>`COALESCE(${organizacion.nombreFantasia}, ${organizacion.razonSocial})`,
        ordenes: sql<string>`COUNT(DISTINCT ${ordenEnvio.ordenId})`,
        monto
      })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .innerJoin(organizacion, eq(organizacion.id, ordenEnvio.proveedorId))
      .where(and(contada(r), ne(ordenEnvio.estado, "cancelado")))
      .groupBy(ordenEnvio.proveedorId, organizacion.nombreFantasia, organizacion.razonSocial)
      .orderBy(desc(monto), asc(ordenEnvio.proveedorId))
      .limit(limite);
    if (rows.length === 0) return [];
    const ids = rows.map((x) => Number(x.proveedorId));
    const skuRows = await this.db
      .select({ proveedorId: ordenEnvio.proveedorId, skus: sql<string>`COUNT(DISTINCT ${ordenLinea.productoId})` })
      .from(ordenLinea)
      .innerJoin(ordenEnvio, eq(ordenEnvio.id, ordenLinea.ordenEnvioId))
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .where(
        and(
          contada(r),
          ne(ordenEnvio.estado, "cancelado"),
          sql`${ordenEnvio.proveedorId} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`
        )
      )
      .groupBy(ordenEnvio.proveedorId);
    const skus = new Map(skuRows.map((x) => [Number(x.proveedorId), num(x.skus)]));
    return rows.map((x) => ({
      proveedorId: Number(x.proveedorId),
      nombre: x.nombre,
      skus: skus.get(Number(x.proveedorId)) ?? 0,
      ordenes: num(x.ordenes),
      monto: num(x.monto)
    }));
  }

  private async muestra(where: ReturnType<typeof and>, limite: number): Promise<MuestraSalud> {
    const [t] = await this.db.select({ total: count() }).from(producto).where(where);
    const items = await this.db
      .select({ id: producto.id, nombre: producto.nombre, ean: producto.ean, formato: producto.formato })
      .from(producto)
      .where(where)
      .orderBy(asc(producto.id))
      .limit(limite);
    return { total: num(t?.total), items: items.map(aSalud) };
  }

  productosSinImagen(limite: number) {
    return this.muestra(and(eq(producto.estado, "publicado"), sinImagenSql), limite);
  }

  productosSinOfertas(limite: number) {
    const conOferta = sql`EXISTS (SELECT 1 FROM ${oferta} WHERE ${oferta.productoId} = ${producto.id} AND ${oferta.estado} = 'publicada')`;
    return this.muestra(and(eq(producto.estado, "publicado"), sql`NOT ${conOferta}`), limite);
  }

  async productosParaDuplicados() {
    const rows = await this.db
      .select({ id: producto.id, nombre: producto.nombre, ean: producto.ean, formato: producto.formato })
      .from(producto)
      .where(ne(producto.estado, "archivado"))
      .orderBy(asc(producto.id));
    return rows.map(aSalud);
  }
}
