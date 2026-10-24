import { and, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type {
  FiltrosProveedores,
  Proveedor,
  ProveedorDocumento,
  ProveedorEstado,
  ProveedorListado,
  ProveedorRepository,
  RegistroAuditoria,
  RevisionDocumento
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { proveedorDocumento } from "../db/schema/proveedor-documento.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

type OrgRow = typeof organizacion.$inferSelect;
const num = (v: string | null) => (v === null ? null : Number(v));
const bool = (v: number | null) => (v === null ? null : v === 1);
const escaparLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function toProveedor(f: OrgRow): Proveedor {
  return {
    id: f.id,
    tipo: "proveedor",
    razonSocial: f.razonSocial,
    rut: f.rut,
    nombreFantasia: f.nombreFantasia,
    giro: f.giro,
    emailContacto: f.emailContacto,
    telefono: f.telefono,
    direccionId: f.direccionId,
    estado: f.estado,
    comisionPct: num(f.comisionPct),
    plazoEstandarHoras: f.plazoEstandarHoras,
    plazoFueraRegionHoras: f.plazoFueraRegionHoras,
    horaCorte: f.horaCorte,
    despachoGratisDesde: f.despachoGratisDesde,
    ofreceDespacho: bool(f.ofreceDespacho),
    ofreceRetiro: bool(f.ofreceRetiro),
    entregasATiempoPct: num(f.entregasATiempoPct),
    banco: f.banco,
    cuentaBancaria: f.cuentaBancaria,
    creadaEn: f.creadaEn
  };
}

const docSelect = {
  id: proveedorDocumento.id,
  proveedorId: proveedorDocumento.proveedorId,
  tipo: proveedorDocumento.tipo,
  url: proveedorDocumento.url,
  venceEn: proveedorDocumento.venceEn,
  vigencia: proveedorDocumento.estado,
  revisionEstado: proveedorDocumento.revisionEstado,
  motivoRechazo: proveedorDocumento.motivoRechazo,
  revisadoEn: proveedorDocumento.revisadoEn,
  revisorId: usuario.id,
  revisorNombre: usuario.nombre
};

function toDocumento(f: {
  id: number;
  proveedorId: number;
  tipo: ProveedorDocumento["tipo"];
  url: string;
  venceEn: string | null;
  vigencia: ProveedorDocumento["vigencia"];
  revisionEstado: ProveedorDocumento["revisionEstado"];
  motivoRechazo: string | null;
  revisadoEn: Date | null;
  revisorId: number | null;
  revisorNombre: string | null;
}): ProveedorDocumento {
  return {
    id: f.id,
    proveedorId: f.proveedorId,
    tipo: f.tipo,
    url: f.url,
    venceEn: f.venceEn,
    vigencia: f.vigencia,
    revisionEstado: f.revisionEstado,
    motivoRechazo: f.motivoRechazo,
    revisadoPor: f.revisorId !== null && f.revisorNombre !== null ? { id: f.revisorId, nombre: f.revisorNombre } : null,
    revisadoEn: f.revisadoEn
  };
}

// Implementacion Drizzle/MySQL del puerto ProveedorRepository.
export class DrizzleProveedorRepository implements ProveedorRepository {
  constructor(private readonly db: DbClient) {}

  async listar(f: FiltrosProveedores): Promise<{ items: ProveedorListado[]; total: number }> {
    const cond: SQL[] = [eq(organizacion.tipo, "proveedor")];
    if (f.estado) cond.push(eq(organizacion.estado, f.estado));
    if (f.q) {
      const p = `%${escaparLike(f.q)}%`;
      const b = or(like(organizacion.razonSocial, p), like(organizacion.nombreFantasia, p), like(organizacion.rut, p));
      if (b) cond.push(b);
    }
    const where = and(...cond);
    const [{ total }] = await this.db.select({ total: count() }).from(organizacion).where(where);
    // Subconsulta correlacionada con nombres calificados a mano (Drizzle omite el prefijo de tabla).
    const cnt = (rev?: "pendiente" | "aprobado" | "rechazado") =>
      sql<number>`(select count(*) from proveedor_documento d where d.proveedor_id = organizacion.id${
        rev ? sql` and d.revision_estado = ${rev}` : sql``
      })`;
    const filas = await this.db
      .select({
        o: organizacion,
        dTotal: cnt(),
        dPend: cnt("pendiente"),
        dApro: cnt("aprobado"),
        dRech: cnt("rechazado")
      })
      .from(organizacion)
      .where(where)
      .orderBy(desc(organizacion.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    return {
      total,
      items: filas.map((r) => ({
        id: r.o.id,
        razonSocial: r.o.razonSocial,
        nombreFantasia: r.o.nombreFantasia,
        rut: r.o.rut,
        estado: r.o.estado,
        comisionPct: num(r.o.comisionPct),
        creadaEn: r.o.creadaEn,
        documentos: {
          total: Number(r.dTotal),
          pendientes: Number(r.dPend),
          aprobados: Number(r.dApro),
          rechazados: Number(r.dRech)
        }
      }))
    };
  }

  async buscarPorId(id: number): Promise<Proveedor | null> {
    const [f] = await this.db
      .select()
      .from(organizacion)
      .where(and(eq(organizacion.id, id), eq(organizacion.tipo, "proveedor")))
      .limit(1);
    return f ? toProveedor(f) : null;
  }

  async listarDocumentos(proveedorId: number): Promise<ProveedorDocumento[]> {
    const filas = await this.db
      .select(docSelect)
      .from(proveedorDocumento)
      .leftJoin(usuario, eq(proveedorDocumento.revisadoPor, usuario.id))
      .where(eq(proveedorDocumento.proveedorId, proveedorId))
      .orderBy(proveedorDocumento.id);
    return filas.map(toDocumento);
  }

  async buscarDocumento(documentoId: number): Promise<ProveedorDocumento | null> {
    const [f] = await this.db
      .select(docSelect)
      .from(proveedorDocumento)
      .leftJoin(usuario, eq(proveedorDocumento.revisadoPor, usuario.id))
      .where(eq(proveedorDocumento.id, documentoId))
      .limit(1);
    return f ? toDocumento(f) : null;
  }

  async revisarDocumento(documentoId: number, r: RevisionDocumento, auditoria: RegistroAuditoria) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(proveedorDocumento)
        .set({
          revisionEstado: r.revisionEstado,
          motivoRechazo: r.motivoRechazo,
          revisadoPor: r.revisadoPor,
          revisadoEn: r.revisadoEn
        })
        .where(eq(proveedorDocumento.id, documentoId));
      await tx.insert(auditoriaLog).values(auditoria);
    });
    return (await this.buscarDocumento(documentoId)) as ProveedorDocumento;
  }

  async cambiarEstado(id: number, estado: ProveedorEstado, comisionPct: number | undefined, auditoria: RegistroAuditoria) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(organizacion)
        .set({ estado, ...(comisionPct !== undefined ? { comisionPct: comisionPct.toFixed(2) } : {}) })
        .where(eq(organizacion.id, id));
      await tx.insert(auditoriaLog).values(auditoria);
    });
    return (await this.buscarPorId(id)) as Proveedor;
  }
}
