import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import type {
  ConteoDia,
  ConteoOfertaDia,
  EventoAnaliticoRepository,
  NuevoEventoAnalitico,
  RangoFechas
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { eventoAnalitico as e } from "../db/schema/evento-analitico.schema.js";
import { oferta } from "../db/schema/oferta.schema.js";
import { producto } from "../db/schema/producto.schema.js";

const aFila = (n: NuevoEventoAnalitico) => ({
  tipoEvento: n.tipoEvento,
  sesionId: n.sesionId,
  usuarioId: n.usuarioId,
  productoId: n.productoId,
  ofertaId: n.ofertaId,
  comunaId: n.comunaId,
  origen: n.origen,
  convirtio: n.convirtio === null ? null : n.convirtio ? 1 : 0,
  termino: n.termino,
  resultados: n.resultados
});

// Las agregaciones filtran siempre por creado_en (indice) y luego por tipo_evento / producto_id / oferta_id.
const dia = sql<string>`DATE_FORMAT(${e.creadoEn}, '%Y-%m-%d')`;
const enRango = (r: RangoFechas) => and(gte(e.creadoEn, r.desde), lt(e.creadoEn, r.hastaExclusivo));

export class DrizzleEventoAnaliticoRepository implements EventoAnaliticoRepository {
  constructor(private readonly db: DbClient) {}

  async registrar(eventos: NuevoEventoAnalitico[]) {
    if (eventos.length === 0) return;
    try {
      await this.db.insert(e).values(eventos.map(aFila));
    } catch (err) {
      // Un evento con FK invalida no debe arrastrar al resto del lote: se reintenta de a uno.
      if (eventos.length === 1) throw err;
      let ultimo: unknown;
      for (const ev of eventos) {
        try {
          await this.db.insert(e).values(aFila(ev));
        } catch (errFila) {
          ultimo = errFila;
        }
      }
      if (ultimo) throw ultimo;
    }
  }

  async conteoPorDia(r: RangoFechas): Promise<ConteoDia[]> {
    const rows = await this.db
      .select({ fecha: dia, tipo: e.tipoEvento, total: count() })
      .from(e)
      .where(enRango(r))
      .groupBy(dia, e.tipoEvento);
    return rows.map((x) => ({ fecha: x.fecha, tipo: x.tipo, total: Number(x.total) }));
  }

  async topProductosVistos(r: RangoFechas, limite: number) {
    const rows = await this.db
      .select({ productoId: e.productoId, nombre: producto.nombre, vistas: count() })
      .from(e)
      .innerJoin(producto, eq(producto.id, e.productoId))
      .where(and(enRango(r), eq(e.tipoEvento, "vista_producto")))
      .groupBy(e.productoId, producto.nombre)
      .orderBy(desc(count()))
      .limit(limite);
    return rows.map((x) => ({ productoId: Number(x.productoId), nombre: x.nombre, vistas: Number(x.vistas) }));
  }

  async topTerminos(r: RangoFechas, limite: number) {
    const rows = await this.db
      .select({ termino: e.termino, busquedas: count() })
      .from(e)
      .where(and(enRango(r), eq(e.tipoEvento, "busqueda")))
      .groupBy(e.termino)
      .orderBy(desc(count()))
      .limit(limite);
    return rows.flatMap((x) => (x.termino ? [{ termino: x.termino, busquedas: Number(x.busquedas) }] : []));
  }

  async conteoPorOfertaDia(r: RangoFechas, proveedorId: number): Promise<ConteoOfertaDia[]> {
    const campos = { ofertaId: oferta.id, productoId: oferta.productoId, producto: producto.nombre, fecha: dia, total: count() };
    const [vistas, clicks] = await Promise.all([
      this.db
        .select(campos)
        .from(e)
        .innerJoin(oferta, eq(oferta.productoId, e.productoId))
        .innerJoin(producto, eq(producto.id, oferta.productoId))
        .where(and(enRango(r), eq(e.tipoEvento, "vista_producto"), eq(oferta.proveedorId, proveedorId)))
        .groupBy(oferta.id, oferta.productoId, producto.nombre, dia),
      this.db
        .select(campos)
        .from(e)
        .innerJoin(oferta, eq(oferta.id, e.ofertaId))
        .innerJoin(producto, eq(producto.id, oferta.productoId))
        .where(and(enRango(r), eq(e.tipoEvento, "click_oferta"), eq(oferta.proveedorId, proveedorId)))
        .groupBy(oferta.id, oferta.productoId, producto.nombre, dia)
    ]);
    const mapa = (rows: typeof vistas, tipo: ConteoOfertaDia["tipo"]): ConteoOfertaDia[] =>
      rows.map((x) => ({ ofertaId: Number(x.ofertaId), productoId: Number(x.productoId), producto: x.producto, fecha: x.fecha, tipo, total: Number(x.total) }));
    return [...mapa(vistas, "vista_producto"), ...mapa(clicks, "click_oferta")];
  }
}
