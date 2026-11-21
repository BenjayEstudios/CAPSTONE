import { and, asc, count, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type {
  FiltrosProveedores,
  Proveedor,
  ProveedorDocumento,
  ProveedorEstado,
  ProveedorListado,
  ProveedorRepository,
  RegistroAuditoria,
  RevisionDocumento,
  CondicionesEntregaProveedor,
  CambiosPerfilProveedor,
  DireccionPerfil,
  NuevaDireccionPerfil,
  PerfilProveedor
} from "@cotizapp/domain";
import { consultar, type DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { comuna } from "../db/schema/comuna.schema.js";
import { direccion } from "../db/schema/direccion.schema.js";
import { puntoRetiro } from "../db/schema/punto-retiro.schema.js";
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

  private async direccionPerfil(db: Pick<DbClient, "select">, id: number | null): Promise<DireccionPerfil | null> {
    if (id === null) return null;
    const [d] = await db
      .select({ calle: direccion.calle, numero: direccion.numero, complemento: direccion.complemento, comunaId: direccion.comunaId, comuna: comuna.nombre, region: comuna.regionNombre })
      .from(direccion)
      .innerJoin(comuna, eq(comuna.id, direccion.comunaId))
      .where(eq(direccion.id, id));
    return d ?? null;
  }

  // Perfil de empresa (KAN-108). Cinco lecturas chicas por PK o por la FK del
  // proveedor: organizacion, su direccion, el punto de retiro principal (el
  // activo de menor id) con su direccion, las regiones con cobertura y el equipo.
  async perfil(proveedorId: number): Promise<PerfilProveedor | null> {
    const [org] = await this.db.select().from(organizacion).where(and(eq(organizacion.id, proveedorId), eq(organizacion.tipo, "proveedor")));
    if (!org) return null;
    const [punto] = await this.db
      .select()
      .from(puntoRetiro)
      .where(and(eq(puntoRetiro.proveedorId, proveedorId), eq(puntoRetiro.activo, 1)))
      .orderBy(asc(puntoRetiro.id))
      .limit(1);
    const regiones = await consultar<{ region: string }>(
      this.db,
      sql`SELECT DISTINCT (SELECT MIN(r.region_nombre) FROM comuna r WHERE r.region_codigo = pc.region_codigo) AS region, pc.region_codigo
          FROM proveedor_cobertura pc WHERE pc.proveedor_id = ${proveedorId} ORDER BY pc.region_codigo`
    );
    const equipo = await this.db
      .select({ nombre: usuario.nombre, email: usuario.email, telefono: usuario.telefono })
      .from(usuario)
      .where(and(eq(usuario.organizacionId, proveedorId), eq(usuario.estado, "activo")))
      .orderBy(asc(usuario.id));
    const bodegaDir = punto ? await this.direccionPerfil(this.db, punto.direccionId) : null;
    return {
      id: org.id,
      razonSocial: org.razonSocial,
      rut: org.rut,
      nombreFantasia: org.nombreFantasia,
      giro: org.giro,
      emailContacto: org.emailContacto,
      telefono: org.telefono,
      direccion: await this.direccionPerfil(this.db, org.direccionId),
      bodega: punto && bodegaDir ? { id: punto.id, nombre: punto.nombre, horario: punto.horario, direccion: bodegaDir } : null,
      plazoEstandarHoras: org.plazoEstandarHoras,
      plazoFueraRegionHoras: org.plazoFueraRegionHoras,
      horaCorte: org.horaCorte ? org.horaCorte.slice(0, 5) : null,
      despachoGratisDesde: org.despachoGratisDesde,
      ofreceDespacho: org.ofreceDespacho === 1,
      ofreceRetiro: org.ofreceRetiro === 1,
      banco: org.banco,
      cuentaBancaria: org.cuentaBancaria,
      estado: org.estado,
      comisionPct: num(org.comisionPct),
      entregasATiempoPct: num(org.entregasATiempoPct),
      creadaEn: org.creadaEn,
      regiones: regiones.map((r) => r.region).filter(Boolean),
      equipo
    };
  }

  // Una direccion nueva nunca pisa la anterior: la puede citar un retiro o
  // una orden pasada (y en el seed la bodega comparte fila con la direccion
  // comercial). Se inserta y se apunta a ella.
  async actualizarPerfil(proveedorId: number, cambios: CambiosPerfilProveedor, auditoria: RegistroAuditoria): Promise<void> {
    await this.db.transaction(async (tx) => {
      const insertarDireccion = async (d: NuevaDireccionPerfil) => {
        const [r] = await tx.insert(direccion).values({ calle: d.calle, numero: d.numero, complemento: d.complemento, comunaId: d.comunaId });
        return r.insertId;
      };
      const { direccion: dir, bodega, horaCorte, ofreceDespacho, ofreceRetiro, ...resto } = cambios;
      const set: Partial<typeof organizacion.$inferInsert> = { ...resto };
      if (horaCorte !== undefined) set.horaCorte = horaCorte === null ? null : `${horaCorte}:00`;
      if (ofreceDespacho !== undefined) set.ofreceDespacho = ofreceDespacho ? 1 : 0;
      if (ofreceRetiro !== undefined) set.ofreceRetiro = ofreceRetiro ? 1 : 0;
      if (dir) set.direccionId = await insertarDireccion(dir);
      if (Object.keys(set).length) await tx.update(organizacion).set(set).where(eq(organizacion.id, proveedorId));
      if (bodega) {
        const direccionId = await insertarDireccion(bodega);
        const [punto] = await tx
          .select({ id: puntoRetiro.id })
          .from(puntoRetiro)
          .where(and(eq(puntoRetiro.proveedorId, proveedorId), eq(puntoRetiro.activo, 1)))
          .orderBy(asc(puntoRetiro.id))
          .limit(1)
          .for("update");
        if (punto) await tx.update(puntoRetiro).set({ nombre: bodega.nombre, horario: bodega.horario, direccionId }).where(eq(puntoRetiro.id, punto.id));
        else await tx.insert(puntoRetiro).values({ proveedorId, nombre: bodega.nombre, horario: bodega.horario, direccionId, activo: 1 });
      }
      await tx.insert(auditoriaLog).values(auditoria);
    });
  }

  async cobertura(proveedorId: number): Promise<CondicionesEntregaProveedor> {
    const [org] = await this.db
      .select({ horaCorte: organizacion.horaCorte, despachoGratisDesde: organizacion.despachoGratisDesde, plazoEstandarHoras: organizacion.plazoEstandarHoras, ofreceDespacho: organizacion.ofreceDespacho, ofreceRetiro: organizacion.ofreceRetiro })
      .from(organizacion)
      .where(eq(organizacion.id, proveedorId));
    // La region se nombra desde cualquier comuna con ese codigo (comuna_id NULL = toda la region).
    const zonas = await consultar<{ comunaId: number | null; comuna: string | null; regionCodigo: string; region: string; costoDespacho: number; plazoHoras: number | null }>(
      this.db,
      sql`
        SELECT pc.comuna_id AS comunaId, c.nombre AS comuna, pc.region_codigo AS regionCodigo,
               (SELECT MIN(r.region_nombre) FROM comuna r WHERE r.region_codigo = pc.region_codigo) AS region,
               pc.costo_despacho AS costoDespacho, pc.plazo_horas AS plazoHoras
        FROM proveedor_cobertura pc LEFT JOIN comuna c ON c.id = pc.comuna_id
        WHERE pc.proveedor_id = ${proveedorId}
        ORDER BY pc.region_codigo, pc.comuna_id IS NOT NULL, c.nombre`
    );
    return {
      horaCorte: org?.horaCorte ? org.horaCorte.slice(0, 5) : null,
      despachoGratisDesde: org?.despachoGratisDesde ?? null,
      plazoEstandarHoras: org?.plazoEstandarHoras ?? null,
      ofreceDespacho: org?.ofreceDespacho === 1,
      ofreceRetiro: org?.ofreceRetiro === 1,
      zonas: zonas.map((z) => ({ ...z, costoDespacho: Number(z.costoDespacho), plazoHoras: z.plazoHoras === null ? null : Number(z.plazoHoras) }))
    };
  }

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
