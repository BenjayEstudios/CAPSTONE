import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  Carro,
  CarroItem,
  CarroRepository,
  ContextoCheckout,
  EntradaCheckout,
  OfertaCarro,
  OrdenCreada,
  PlanOrden,
  RegistroAuditoria
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { carro } from "../db/schema/carro.schema.js";
import { comuna } from "../db/schema/comuna.schema.js";
import { direccion } from "../db/schema/direccion.schema.js";
import { oferta } from "../db/schema/oferta.schema.js";
import { ofertaPrecioHistorial } from "../db/schema/oferta-precio-historial.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { producto } from "../db/schema/producto.schema.js";
import { proveedorCobertura } from "../db/schema/proveedor-cobertura.schema.js";
import { puntoRetiro } from "../db/schema/punto-retiro.schema.js";

type Lector = Pick<DbClient, "select">;

function toCarro(f: typeof carro.$inferSelect): Carro {
  const raw = typeof f.items === "string" ? JSON.parse(f.items) : f.items;
  const items: CarroItem[] = (Array.isArray(raw) ? raw : []).map((i: Record<string, number>) => ({
    ofertaId: Number(i.ofertaId ?? i.oferta_id),
    cantidad: Number(i.cantidad),
    precioVisto: Number(i.precioVisto ?? i.precio_visto)
  }));
  return { id: f.id, usuarioId: f.usuarioId, estado: f.estado, items, actualizadoEn: f.actualizadoEn };
}

// items se guarda con las claves del DBML: [{oferta_id, cantidad, precio_visto}].
const aJson = (items: CarroItem[]) => items.map((i) => ({ oferta_id: i.ofertaId, cantidad: i.cantidad, precio_visto: i.precioVisto }));

async function leerOfertas(db: Lector, ids: number[], bloquear: boolean): Promise<OfertaCarro[]> {
  if (ids.length === 0) return [];
  const q = db
    .select({ o: oferta, p: producto })
    .from(oferta)
    .innerJoin(producto, eq(producto.id, oferta.productoId))
    .where(inArray(oferta.id, ids))
    .orderBy(asc(oferta.id));
  // FOR UPDATE de MySQL bloquea las filas de ambas tablas del join; los productos casi no se escriben.
  const filas = await (bloquear ? q.for("update") : q);
  return filas.map(({ o, p }) => ({
    id: o.id,
    productoId: o.productoId,
    proveedorId: o.proveedorId,
    productoNombre: p.nombre,
    formato: p.formato,
    productoPublicado: p.estado === "publicado",
    ofertaPublicada: o.estado === "publicada",
    precioUnitario: o.precioUnitario,
    cajasDisponibles: o.cajasDisponibles,
    unidadesPorCaja: o.unidadesPorCaja,
    minimoCompra: o.minimoCompra,
    plazoHoras: o.plazoHoras,
    modalidadEntrega: o.modalidadEntrega
  }));
}

export class DrizzleCarroRepository implements CarroRepository {
  constructor(private readonly db: DbClient) {}

  async obtenerAbierto(usuarioId: number) {
    const [f] = await this.db
      .select()
      .from(carro)
      .where(and(eq(carro.usuarioId, usuarioId), eq(carro.estado, "abierto")))
      .limit(1);
    return f ? toCarro(f) : null;
  }

  async guardarItems(usuarioId: number, items: CarroItem[]) {
    return this.db.transaction(async (tx) => {
      const [f] = await tx
        .select()
        .from(carro)
        .where(and(eq(carro.usuarioId, usuarioId), eq(carro.estado, "abierto")))
        .limit(1)
        .for("update");
      let id: number;
      if (f) {
        id = f.id;
        await tx.update(carro).set({ items: aJson(items), actualizadoEn: new Date() }).where(eq(carro.id, id));
      } else {
        [{ id }] = await tx.insert(carro).values({ usuarioId, estado: "abierto", items: aJson(items) }).$returningId();
      }
      const [nuevo] = await tx.select().from(carro).where(eq(carro.id, id));
      return toCarro(nuevo);
    });
  }

  ofertasPorIds(ids: number[]) {
    return leerOfertas(this.db, ids, false);
  }

  async confirmar(
    usuarioId: number,
    organizacionId: number,
    entrada: EntradaCheckout,
    planificar: (ctx: ContextoCheckout) => PlanOrden,
    auditoria: (ordenId: number, plan: PlanOrden) => RegistroAuditoria
  ): Promise<OrdenCreada> {
    return this.db.transaction(async (tx) => {
      const [fc] = await tx
        .select()
        .from(carro)
        .where(and(eq(carro.usuarioId, usuarioId), eq(carro.estado, "abierto")))
        .limit(1)
        .for("update");
      const c = fc ? toCarro(fc) : null;
      const ofertas = await leerOfertas(tx, c?.items.map((i) => i.ofertaId) ?? [], true);

      const provIds = [...new Set(ofertas.map((o) => o.proveedorId))];
      const orgs = provIds.length ? await tx.select().from(organizacion).where(inArray(organizacion.id, provIds)) : [];
      const cob = provIds.length ? await tx.select().from(proveedorCobertura).where(inArray(proveedorCobertura.proveedorId, provIds)) : [];
      const puntos = provIds.length ? await tx.select().from(puntoRetiro).where(inArray(puntoRetiro.proveedorId, provIds)) : [];

      let comunaId: number | null = null;
      if (entrada.direccionId !== undefined) {
        const [d] = await tx.select({ comunaId: direccion.comunaId }).from(direccion).where(eq(direccion.id, entrada.direccionId));
        comunaId = d?.comunaId ?? null;
      } else if (entrada.direccionNueva) {
        comunaId = entrada.direccionNueva.comunaId;
      }
      const [cm] = comunaId === null ? [] : await tx.select().from(comuna).where(eq(comuna.id, comunaId));

      const plan = planificar({
        carro: c,
        ofertas,
        proveedores: orgs.map((o) => ({
          id: o.id,
          razonSocial: o.razonSocial,
          activo: o.tipo === "proveedor" && o.estado === "activa",
          comisionPct: o.comisionPct === null ? null : Number(o.comisionPct),
          despachoGratisDesde: o.despachoGratisDesde,
          ofreceDespacho: o.ofreceDespacho === 1,
          ofreceRetiro: o.ofreceRetiro === 1,
          plazoEstandarHoras: o.plazoEstandarHoras,
          coberturas: cob
            .filter((x) => x.proveedorId === o.id)
            .map((x) => ({ comunaId: x.comunaId, regionCodigo: x.regionCodigo, costoDespacho: x.costoDespacho, plazoHoras: x.plazoHoras }))
        })),
        puntosRetiro: puntos.map((p) => ({ id: p.id, proveedorId: p.proveedorId, activo: p.activo === 1 })),
        comunaDestino: cm ? { id: cm.id, regionCodigo: cm.regionCodigo } : null
      });

      const hayDespacho = plan.envios.some((e) => e.modalidad === "despacho");
      let direccionId: number | null = null;
      if (hayDespacho) {
        if (entrada.direccionId !== undefined) direccionId = entrada.direccionId;
        else if (entrada.direccionNueva) {
          [{ id: direccionId }] = await tx.insert(direccion).values(entrada.direccionNueva).$returningId();
        }
      }

      const [{ id: ordenId }] = await tx
        .insert(orden)
        .values({
          codigo: randomUUID().replace(/-/g, "").slice(0, 16),
          usuarioId,
          organizacionId,
          direccionEntregaId: direccionId,
          subtotal: plan.subtotal,
          costoDespachoTotal: plan.costoDespachoTotal,
          comisionTotal: plan.comisionTotal,
          total: plan.total,
          requiereFactura: plan.requiereFactura ? 1 : 0
        })
        .$returningId();
      const codigo = `CM-${90000 + ordenId}`;
      await tx.update(orden).set({ codigo }).where(eq(orden.id, ordenId));

      for (const e of plan.envios) {
        const [{ id: envioId }] = await tx
          .insert(ordenEnvio)
          .values({
            ordenId,
            proveedorId: e.proveedorId,
            modalidad: e.modalidad,
            puntoRetiroId: e.puntoRetiroId,
            direccionEntregaId: e.modalidad === "despacho" ? direccionId : null,
            plazoHoras: e.plazoHoras,
            costoDespacho: e.costoDespacho,
            subtotal: e.subtotal,
            comisionPct: e.comisionPct.toFixed(2),
            comisionMonto: e.comisionMonto
          })
          .$returningId();
        await tx.insert(ordenLinea).values(e.lineas.map((l) => ({ ...l, ordenEnvioId: envioId })));
      }

      for (const s of plan.stock) {
        await tx.update(oferta).set({ cajasDisponibles: s.cajasNuevas }).where(eq(oferta.id, s.ofertaId));
        const precio = ofertas.find((o) => o.id === s.ofertaId)?.precioUnitario ?? null;
        await tx.insert(ofertaPrecioHistorial).values({
          ofertaId: s.ofertaId,
          precioAnterior: precio,
          precioNuevo: precio,
          cajasAnteriores: s.cajasAnteriores,
          cajasNuevas: s.cajasNuevas,
          motivo: "venta",
          cambiadoPor: usuarioId
        });
      }

      if (!c) throw new Error("planificar debio rechazar un carro inexistente");
      await tx.update(carro).set({ estado: "convertido", actualizadoEn: new Date() }).where(eq(carro.id, c.id));
      await tx.insert(auditoriaLog).values(auditoria(ordenId, plan));
      return { ordenId, codigo };
    });
  }
}
