import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import type {
  CalculoLiquidacion,
  EnvioLiquidado,
  FiltrosLiquidaciones,
  Liquidacion,
  LiquidacionConProveedor,
  LiquidacionRepository,
  OrdenEnvio,
  RangoLiquidacion,
  ResultadoPago
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { liquidacion } from "../db/schema/liquidacion.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";

const toLiquidacion = (f: typeof liquidacion.$inferSelect): Liquidacion => ({ ...f });

export class DrizzleLiquidacionRepository implements LiquidacionRepository {
  constructor(private readonly db: DbClient) {}

  private pendientes(rango: RangoLiquidacion): SQL[] {
    return [
      eq(ordenEnvio.estado, "entregado"),
      isNull(ordenEnvio.liquidacionId),
      gte(ordenEnvio.actualizadoEn, rango.desde),
      lt(ordenEnvio.actualizadoEn, rango.hasta)
    ];
  }

  async proveedoresConPendientes(rango: RangoLiquidacion) {
    const filas = await this.db.selectDistinct({ id: ordenEnvio.proveedorId }).from(ordenEnvio).where(and(...this.pendientes(rango))).orderBy(ordenEnvio.proveedorId);
    return filas.map((f) => f.id);
  }

  async liquidarProveedor(
    proveedorId: number,
    rango: RangoLiquidacion,
    calcular: (envios: OrdenEnvio[]) => CalculoLiquidacion,
    actorId: number | null
  ) {
    return this.db.transaction(async (tx) => {
      const envios = await tx
        .select()
        .from(ordenEnvio)
        .where(and(eq(ordenEnvio.proveedorId, proveedorId), ...this.pendientes(rango)))
        .orderBy(ordenEnvio.id)
        .for("update");
      if (envios.length === 0) return null;
      const c = calcular(envios);
      const [res] = await tx.insert(liquidacion).values({
        proveedorId,
        periodoDesde: rango.periodoDesde,
        periodoHasta: rango.periodoHasta,
        montoBruto: c.montoBruto,
        comision: c.comision,
        montoNeto: c.montoNeto,
        estado: "pendiente"
      });
      const id = Number(res.insertId);
      for (const e of c.envios) {
        await tx
          .update(ordenEnvio)
          .set({
            liquidacionId: id,
            montoBrutoLiquidado: e.montoBruto,
            comisionLiquidada: e.comision,
            montoNetoLiquidado: e.montoNeto,
            actualizadoEn: sql`${ordenEnvio.actualizadoEn}` // conserva la fecha de cierre de la entrega
          })
          .where(and(eq(ordenEnvio.id, e.envioId), isNull(ordenEnvio.liquidacionId)));
      }
      const [fila] = await tx.select().from(liquidacion).where(eq(liquidacion.id, id));
      await tx.insert(auditoriaLog).values({
        usuarioId: actorId,
        entidad: "liquidacion",
        entidadId: id,
        accion: "crear",
        datosAntes: null,
        datosDespues: { proveedorId, periodoDesde: rango.periodoDesde, periodoHasta: rango.periodoHasta, montoBruto: c.montoBruto, comision: c.comision, montoNeto: c.montoNeto, envios: c.envios.map((e) => e.envioId), origen: actorId === null ? "job" : "manual" }
      });
      return toLiquidacion(fila!);
    });
  }

  async listar(f: FiltrosLiquidaciones) {
    const w: SQL[] = [];
    if (f.proveedorId !== undefined) w.push(eq(liquidacion.proveedorId, f.proveedorId));
    if (f.estado) w.push(eq(liquidacion.estado, f.estado));
    if (f.desde) w.push(gte(liquidacion.periodoDesde, f.desde));
    if (f.hasta) w.push(sql`${liquidacion.periodoHasta} <= ${f.hasta}`);
    const where = w.length ? and(...w) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(liquidacion).where(where);
    const filas = await this.db
      .select({ l: liquidacion, proveedorNombre: organizacion.razonSocial })
      .from(liquidacion)
      .innerJoin(organizacion, eq(organizacion.id, liquidacion.proveedorId))
      .where(where)
      .orderBy(desc(liquidacion.periodoDesde), desc(liquidacion.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    const items: LiquidacionConProveedor[] = filas.map((r) => ({ ...toLiquidacion(r.l), proveedorNombre: r.proveedorNombre }));
    return { items, total: Number(total) };
  }

  async buscarPorId(id: number) {
    const [r] = await this.db
      .select({ l: liquidacion, proveedorNombre: organizacion.razonSocial })
      .from(liquidacion)
      .innerJoin(organizacion, eq(organizacion.id, liquidacion.proveedorId))
      .where(eq(liquidacion.id, id));
    if (!r) return null;
    const filas = await this.db
      .select({ e: ordenEnvio, ordenCodigo: orden.codigo })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .where(eq(ordenEnvio.liquidacionId, id))
      .orderBy(ordenEnvio.id);
    const envios: EnvioLiquidado[] = filas.map((x) => ({
      envioId: x.e.id,
      ordenId: x.e.ordenId,
      ordenCodigo: x.ordenCodigo,
      entregadoEn: x.e.actualizadoEn,
      montoBruto: x.e.montoBrutoLiquidado ?? 0,
      comision: x.e.comisionLiquidada ?? 0,
      montoNeto: x.e.montoNetoLiquidado ?? 0
    }));
    return { liquidacion: { ...toLiquidacion(r.l), proveedorNombre: r.proveedorNombre }, envios };
  }

  async marcarPagada(id: number, pagadaEn: Date, actorId: number): Promise<ResultadoPago> {
    return this.db.transaction(async (tx) => {
      const [antes] = await tx.select().from(liquidacion).where(eq(liquidacion.id, id)).for("update");
      if (!antes) return { resultado: "no_existe" } as const;
      if (antes.estado === "pagada") return { resultado: "ya_pagada" } as const;
      await tx.update(liquidacion).set({ estado: "pagada", pagadaEn }).where(eq(liquidacion.id, id));
      const [despues] = await tx.select().from(liquidacion).where(eq(liquidacion.id, id));
      await tx.insert(auditoriaLog).values({
        usuarioId: actorId,
        entidad: "liquidacion",
        entidadId: id,
        accion: "editar",
        datosAntes: { estado: "pendiente", pagadaEn: null },
        datosDespues: { estado: "pagada", pagadaEn: pagadaEn.toISOString() }
      });
      return { resultado: "ok", liquidacion: toLiquidacion(despues!) } as const;
    });
  }
}
