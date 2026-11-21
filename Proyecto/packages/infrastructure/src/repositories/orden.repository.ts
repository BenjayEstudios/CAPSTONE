import { and, asc, count, countDistinct, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import type {
  AlcanceOrdenes,
  ClienteDeProveedor,
  FiltrosOrdenes,
  FiltrosVentas,
  OrdenEnvioEstado,
  VentaProveedor,
  Orden,
  OrdenCompleta,
  OrdenEnvio,
  OrdenLinea,
  OrdenRepository,
  EnvioConLineas,
  ContextoCambioEnvio,
  PlanCambioEnvio,
  RegistroAuditoria,
  ResultadoPagoOrden
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { calificacion } from "../db/schema/calificacion.schema.js";
import { comuna } from "../db/schema/comuna.schema.js";
import { direccion } from "../db/schema/direccion.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { puntoRetiro } from "../db/schema/punto-retiro.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

type Lector = Pick<DbClient, "select">;

const toOrden = (f: typeof orden.$inferSelect): Orden => ({ ...f, requiereFactura: f.requiereFactura === 1 });
const toEnvio = (f: typeof ordenEnvio.$inferSelect): OrdenEnvio => ({ ...f });
const toLinea = (f: typeof ordenLinea.$inferSelect): OrdenLinea => ({ ...f });

export class DrizzleOrdenRepository implements OrdenRepository {
  constructor(private readonly db: DbClient) {}

  private async completar(db: Lector, ordenes: Array<typeof orden.$inferSelect>, alcance: AlcanceOrdenes, conLineas: boolean) {
    if (ordenes.length === 0) return [] as OrdenCompleta[];
    const ids = ordenes.map((o) => o.id);
    const filtroEnvio = [inArray(ordenEnvio.ordenId, ids)];
    if (alcance.tipo === "proveedor") filtroEnvio.push(eq(ordenEnvio.proveedorId, alcance.proveedorId));
    const envios = await db
      .select({ e: ordenEnvio, proveedorNombre: organizacion.razonSocial })
      .from(ordenEnvio)
      .innerJoin(organizacion, eq(organizacion.id, ordenEnvio.proveedorId))
      .where(and(...filtroEnvio))
      .orderBy(ordenEnvio.id);
    const lineas = conLineas && envios.length
      ? await db.select().from(ordenLinea).where(inArray(ordenLinea.ordenEnvioId, envios.map((x) => x.e.id))).orderBy(ordenLinea.id)
      : [];
    // Puntos de retiro de los envios con retiro (solo en el detalle, KAN-96).
    const puntoIds = conLineas ? [...new Set(envios.map((x) => x.e.puntoRetiroId).filter((x): x is number => x !== null))] : [];
    const puntos = puntoIds.length
      ? await db
          .select({ id: puntoRetiro.id, nombre: puntoRetiro.nombre, horario: puntoRetiro.horario, calle: direccion.calle, numero: direccion.numero, complemento: direccion.complemento, comuna: comuna.nombre })
          .from(puntoRetiro)
          .innerJoin(direccion, eq(direccion.id, puntoRetiro.direccionId))
          .innerJoin(comuna, eq(comuna.id, direccion.comunaId))
          .where(inArray(puntoRetiro.id, puntoIds))
      : [];
    const puntoDe = (id: number | null) => {
      const p = puntos.find((x) => x.id === id);
      if (!p) return null;
      const direccionTexto = [[p.calle, p.numero].filter(Boolean).join(" "), p.complemento, p.comuna].filter(Boolean).join(", ");
      return { id: p.id, nombre: p.nombre, horario: p.horario, direccion: direccionTexto };
    };
    // Calificaciones de los envios (solo en el detalle, KAN-99).
    const calificaciones = conLineas && envios.length
      ? await db
          .select({ ordenEnvioId: calificacion.ordenEnvioId, puntaje: calificacion.puntaje, comentario: calificacion.comentario, creadaEn: calificacion.creadaEn })
          .from(calificacion)
          .where(inArray(calificacion.ordenEnvioId, envios.map((x) => x.e.id)))
      : [];
    const calificacionDe = (envioId: number) => {
      const c = calificaciones.find((x) => x.ordenEnvioId === envioId);
      return c ? { puntaje: c.puntaje, comentario: c.comentario, creadaEn: c.creadaEn } : null;
    };
    const clientes = await db
      .select({ ordenId: orden.id, clienteNombre: usuario.nombre, organizacionNombre: organizacion.razonSocial })
      .from(orden)
      .innerJoin(usuario, eq(usuario.id, orden.usuarioId))
      .innerJoin(organizacion, eq(organizacion.id, orden.organizacionId))
      .where(inArray(orden.id, ids));
    const dirIds = ordenes.map((o) => o.direccionEntregaId).filter((x): x is number => x !== null);
    const direcciones = dirIds.length
      ? await db
          .select({ id: direccion.id, calle: direccion.calle, numero: direccion.numero, complemento: direccion.complemento, referencia: direccion.referencia, comunaNombre: comuna.nombre, regionNombre: comuna.regionNombre })
          .from(direccion)
          .innerJoin(comuna, eq(comuna.id, direccion.comunaId))
          .where(inArray(direccion.id, dirIds))
      : [];

    return ordenes.map((o): OrdenCompleta => {
      const cli = clientes.find((c) => c.ordenId === o.id);
      const dir = direcciones.find((d) => d.id === o.direccionEntregaId);
      return {
        orden: toOrden(o),
        envios: envios
          .filter((x) => x.e.ordenId === o.id)
          .map((x): EnvioConLineas => ({
            ...toEnvio(x.e),
            proveedorNombre: x.proveedorNombre,
            lineas: lineas.filter((l) => l.ordenEnvioId === x.e.id).map(toLinea),
            ...(conLineas ? { puntoRetiro: puntoDe(x.e.puntoRetiroId), calificacion: calificacionDe(x.e.id) } : {})
          })),
        clienteNombre: cli?.clienteNombre ?? "",
        organizacionNombre: cli?.organizacionNombre ?? "",
        direccionEntrega: dir
          ? { calle: dir.calle, numero: dir.numero, complemento: dir.complemento, referencia: dir.referencia, comunaNombre: dir.comunaNombre, regionNombre: dir.regionNombre }
          : null
      };
    });
  }

  async listar(f: FiltrosOrdenes) {
    const condiciones: SQL[] = [];
    const a = f.alcance;
    if (a.tipo === "cliente") condiciones.push(eq(orden.usuarioId, a.usuarioId));
    if (a.tipo === "proveedor") {
      condiciones.push(eq(ordenEnvio.proveedorId, a.proveedorId));
      if (f.estado) condiciones.push(eq(ordenEnvio.estado, f.estado as OrdenEnvio["estado"]));
    } else if (f.estado) {
      condiciones.push(eq(orden.estado, f.estado as Orden["estado"]));
    }
    const where = condiciones.length ? and(...condiciones) : undefined;

    const porProveedor = a.tipo === "proveedor";
    const [{ total }] = porProveedor
      ? await this.db.select({ total: count() }).from(orden).innerJoin(ordenEnvio, eq(ordenEnvio.ordenId, orden.id)).where(where)
      : await this.db.select({ total: count() }).from(orden).where(where);
    const filas = porProveedor
      ? await this.db
          .select({ o: orden })
          .from(orden)
          .innerJoin(ordenEnvio, eq(ordenEnvio.ordenId, orden.id))
          .where(where)
          .orderBy(desc(orden.id))
          .limit(f.tamano)
          .offset((f.pagina - 1) * f.tamano)
      : await this.db
          .select({ o: orden })
          .from(orden)
          .where(where)
          .orderBy(desc(orden.id))
          .limit(f.tamano)
          .offset((f.pagina - 1) * f.tamano);
    return { items: await this.completar(this.db, filas.map((x) => x.o), a, false), total };
  }

  // Ordenes de venta del proveedor (KAN-105). Entra por
  // ix_orden_envio_proveedor_estado; lineas y cajas salen de orden_linea por
  // su FK (orden_envio_id). La comuna es la de la direccion de entrega o la
  // del punto de retiro, segun la modalidad.
  async ventasDeProveedor(f: FiltrosVentas) {
    const comunaEntrega = alias(comuna, "comuna_entrega");
    const comunaRetiro = alias(comuna, "comuna_retiro");
    const dirEntrega = alias(direccion, "dir_entrega");
    const dirRetiro = alias(direccion, "dir_retiro");
    const base = and(eq(ordenEnvio.proveedorId, f.proveedorId), ne(orden.estado, "pendiente_pago"));
    const where = f.estado ? and(base, eq(ordenEnvio.estado, f.estado)) : base;

    const filas = await this.db
      .select({
        envioId: ordenEnvio.id,
        ordenId: orden.id,
        folio: orden.codigo,
        cliente: sql<string>`COALESCE(${organizacion.nombreFantasia}, ${organizacion.razonSocial})`,
        modalidad: ordenEnvio.modalidad,
        comunaEntrega: comunaEntrega.nombre,
        comunaRetiro: comunaRetiro.nombre,
        pagadoEn: orden.pagadoEn,
        creadaEn: orden.creadaEn,
        lineas: sql<number>`(SELECT COUNT(*) FROM orden_linea l WHERE l.orden_envio_id = ${ordenEnvio.id})`.mapWith(Number),
        cajas: sql<number>`(SELECT COALESCE(SUM(l.cantidad), 0) FROM orden_linea l WHERE l.orden_envio_id = ${ordenEnvio.id})`.mapWith(Number),
        subtotal: ordenEnvio.subtotal,
        costoDespacho: ordenEnvio.costoDespacho,
        estado: ordenEnvio.estado,
        ordenEstado: orden.estado
      })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .innerJoin(organizacion, eq(organizacion.id, orden.organizacionId))
      .leftJoin(dirEntrega, eq(dirEntrega.id, ordenEnvio.direccionEntregaId))
      .leftJoin(comunaEntrega, eq(comunaEntrega.id, dirEntrega.comunaId))
      .leftJoin(puntoRetiro, eq(puntoRetiro.id, ordenEnvio.puntoRetiroId))
      .leftJoin(dirRetiro, eq(dirRetiro.id, puntoRetiro.direccionId))
      .leftJoin(comunaRetiro, eq(comunaRetiro.id, dirRetiro.comunaId))
      .where(where)
      .orderBy(desc(orden.id), desc(ordenEnvio.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);

    const porEstado = await this.db
      .select({ estado: ordenEnvio.estado, n: count() })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .where(base)
      .groupBy(ordenEnvio.estado);
    const conteo: Partial<Record<OrdenEnvioEstado, number>> = {};
    for (const c of porEstado) conteo[c.estado] = c.n;

    const items = filas.map(
      (v): VentaProveedor => ({
        envioId: v.envioId,
        ordenId: v.ordenId,
        folio: v.folio,
        cliente: v.cliente,
        modalidad: v.modalidad,
        comuna: (v.modalidad === "despacho" ? v.comunaEntrega : v.comunaRetiro) ?? null,
        fecha: v.pagadoEn ?? v.creadaEn,
        lineas: v.lineas,
        cajas: v.cajas,
        monto: v.subtotal + (v.costoDespacho ?? 0),
        estado: v.estado,
        ordenEstado: v.ordenEstado
      })
    );
    const total = f.estado ? (conteo[f.estado] ?? 0) : Object.values(conteo).reduce((t, n) => t + n, 0);
    return { items, total, conteo };
  }

  // Clientes del proveedor (KAN-106): una fila por organizacion compradora
  // con al menos una orden pagada o esperando pago en la que el proveedor
  // tenga un envio. Entra por ix_orden_envio_proveedor_estado y agrupa por
  // la organizacion de la orden.
  async clientesDeProveedor(proveedorId: number, p: { pagina: number; tamano: number }) {
    const pagada = sql`${orden.estado} NOT IN ('pendiente_pago', 'reembolsada')`;
    const esperandoPago = sql`(${orden.estado} = 'pendiente_pago' AND ${orden.estadoPago} <> 'fallido')`;
    const where = and(eq(ordenEnvio.proveedorId, proveedorId), or(pagada, esperandoPago));
    const fechaCompra = sql`CASE WHEN ${pagada} THEN COALESCE(${orden.pagadoEn}, ${orden.creadaEn}) END`;
    const monto = sql<number>`COALESCE(SUM(CASE WHEN ${pagada} AND ${ordenEnvio.estado} <> 'cancelado' THEN ${ordenEnvio.subtotal} + COALESCE(${ordenEnvio.costoDespacho}, 0) END), 0)`.mapWith(Number);

    const filas = await this.db
      .select({
        organizacionId: organizacion.id,
        nombreFantasia: organizacion.nombreFantasia,
        razonSocial: organizacion.razonSocial,
        rut: organizacion.rut,
        giro: organizacion.giro,
        email: organizacion.emailContacto,
        telefono: organizacion.telefono,
        comunaOrganizacion: comuna.nombre,
        // Si la organizacion no tiene direccion, la comuna de su ultima entrega con este proveedor.
        comunaEntrega: sql<string | null>`(
          SELECT c2.nombre FROM orden o2
          JOIN orden_envio e2 ON e2.orden_id = o2.id AND e2.proveedor_id = ${proveedorId}
          JOIN direccion d2 ON d2.id = o2.direccion_entrega_id
          JOIN comuna c2 ON c2.id = d2.comuna_id
          WHERE o2.organizacion_id = ${organizacion.id}
          ORDER BY o2.id DESC LIMIT 1)`,
        ordenes: sql<number>`COUNT(DISTINCT CASE WHEN ${pagada} THEN ${orden.id} END)`.mapWith(Number),
        pendientes: sql<number>`COUNT(DISTINCT CASE WHEN ${esperandoPago} THEN ${orden.id} END)`.mapWith(Number),
        monto,
        primeraCompra: sql<Date | null>`MIN(${fechaCompra})`.mapWith(orden.pagadoEn),
        ultimaCompra: sql<Date | null>`MAX(${fechaCompra})`.mapWith(orden.pagadoEn)
      })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .innerJoin(organizacion, eq(organizacion.id, orden.organizacionId))
      .leftJoin(direccion, eq(direccion.id, organizacion.direccionId))
      .leftJoin(comuna, eq(comuna.id, direccion.comunaId))
      .where(where)
      .groupBy(organizacion.id, comuna.nombre)
      .orderBy(desc(monto), asc(organizacion.id))
      .limit(p.tamano)
      .offset((p.pagina - 1) * p.tamano);

    const [{ total }] = await this.db
      .select({ total: countDistinct(orden.organizacionId) })
      .from(ordenEnvio)
      .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
      .where(where);

    const items = filas.map(
      ({ comunaOrganizacion, comunaEntrega, ...c }): ClienteDeProveedor => ({ ...c, comuna: comunaOrganizacion ?? comunaEntrega ?? null })
    );
    return { items, total };
  }

  async buscarPorId(id: number, alcance: AlcanceOrdenes) {
    const [o] = await this.db.select().from(orden).where(eq(orden.id, id));
    if (!o) return null;
    if (alcance.tipo === "cliente" && o.usuarioId !== alcance.usuarioId) return null;
    const [oc] = await this.completar(this.db, [o], alcance, true);
    if (alcance.tipo === "proveedor" && oc.envios.length === 0) return null;
    return oc;
  }

  async buscarPorReferenciaPasarela(referencia: string) {
    const [o] = await this.db.select().from(orden).where(eq(orden.referenciaPasarela, referencia));
    return o ? toOrden(o) : null;
  }

  async registrarInicioPago(ordenId: number, referencia: string) {
    await this.db.update(orden).set({ referenciaPasarela: referencia }).where(eq(orden.id, ordenId));
  }

  async registrarResultadoPago(ordenId: number, r: ResultadoPagoOrden, auditoria: RegistroAuditoria) {
    return this.db.transaction(async (tx) => {
      const [o] = await tx.select().from(orden).where(eq(orden.id, ordenId)).for("update");
      if (!o || o.estado !== "pendiente_pago") return false;
      await tx
        .update(orden)
        .set(
          r.aprobado
            ? { estado: "pagada", estadoPago: "pagado", medioPago: r.medioPago, referenciaPasarela: r.referencia, pagadoEn: new Date() }
            : { estadoPago: "fallido", medioPago: r.medioPago, referenciaPasarela: r.referencia }
        )
        .where(eq(orden.id, ordenId));
      await tx.insert(auditoriaLog).values(auditoria);
      return true;
    });
  }

  async buscarEnvio(id: number) {
    const [e] = await this.db.select().from(ordenEnvio).where(eq(ordenEnvio.id, id));
    return e ? toEnvio(e) : null;
  }

  async cambiarEstadoEnvio(envioId: number, planificar: (ctx: ContextoCambioEnvio) => Promise<PlanCambioEnvio>) {
    await this.db.transaction(async (tx) => {
      const [e] = await tx.select().from(ordenEnvio).where(eq(ordenEnvio.id, envioId)).for("update");
      const [o] = await tx.select().from(orden).where(eq(orden.id, e.ordenId)).for("update");
      const hermanos = await tx.select().from(ordenEnvio).where(eq(ordenEnvio.ordenId, o.id));
      const plan = await planificar({
        envio: toEnvio(e),
        orden: toOrden(o),
        hermanos: hermanos.map(toEnvio),
        entregadosProveedor: async () => {
          const filas = await tx
            .select({ pagadoEn: orden.pagadoEn, creadaEn: orden.creadaEn, fin: ordenEnvio.actualizadoEn, plazoHoras: ordenEnvio.plazoHoras })
            .from(ordenEnvio)
            .innerJoin(orden, eq(orden.id, ordenEnvio.ordenId))
            .where(and(eq(ordenEnvio.proveedorId, e.proveedorId), eq(ordenEnvio.estado, "entregado"), ne(ordenEnvio.id, e.id)));
          return filas.map((r) => ({ inicio: r.pagadoEn ?? r.creadaEn, fin: r.fin, plazoHoras: r.plazoHoras }));
        }
      });
      await tx.update(ordenEnvio).set({ estado: plan.estadoEnvio, actualizadoEn: new Date() }).where(eq(ordenEnvio.id, envioId));
      if (plan.estadoOrden !== o.estado) await tx.update(orden).set({ estado: plan.estadoOrden }).where(eq(orden.id, o.id));
      if (plan.entregasATiempoPct !== null) {
        await tx
          .update(organizacion)
          .set({ entregasATiempoPct: plan.entregasATiempoPct.toFixed(2) })
          .where(eq(organizacion.id, e.proveedorId));
      }
      if (plan.auditoria.length) await tx.insert(auditoriaLog).values(plan.auditoria);
    });
  }
}
