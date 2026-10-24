import { and, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import type {
  AlcanceOrdenes,
  FiltrosOrdenes,
  Orden,
  OrdenCompleta,
  OrdenEnvio,
  OrdenLinea,
  OrdenRepository,
  EnvioConLineas,
  ContextoCambioEnvio,
  PlanCambioEnvio
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { comuna } from "../db/schema/comuna.schema.js";
import { direccion } from "../db/schema/direccion.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
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
            lineas: lineas.filter((l) => l.ordenEnvioId === x.e.id).map(toLinea)
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

  async buscarPorId(id: number, alcance: AlcanceOrdenes) {
    const [o] = await this.db.select().from(orden).where(eq(orden.id, id));
    if (!o) return null;
    if (alcance.tipo === "cliente" && o.usuarioId !== alcance.usuarioId) return null;
    const [oc] = await this.completar(this.db, [o], alcance, true);
    if (alcance.tipo === "proveedor" && oc.envios.length === 0) return null;
    return oc;
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
