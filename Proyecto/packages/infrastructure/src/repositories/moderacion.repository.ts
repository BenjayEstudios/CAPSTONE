import { and, asc, count, eq, isNull, sql, type SQL } from "drizzle-orm";
import type {
  CambioCaso,
  EntidadReferenciada,
  EventoModeracion,
  FiltrosCasos,
  ModeracionCaso,
  ModeracionRepository,
  ModeracionTipo,
  NuevoCaso,
  RegistroAuditoria,
  UsuarioInterno
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { moderacionCaso } from "../db/schema/moderacion-caso.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { producto } from "../db/schema/producto.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

const seleccion = {
  id: moderacionCaso.id,
  tipo: moderacionCaso.tipo,
  entidad: moderacionCaso.entidad,
  entidadId: moderacionCaso.entidadId,
  detalle: moderacionCaso.detalle,
  estado: moderacionCaso.estado,
  asignadoId: moderacionCaso.asignadoA,
  asignadoNombre: usuario.nombre,
  creadoEn: moderacionCaso.creadoEn,
  resueltoEn: moderacionCaso.resueltoEn
};

function aCaso(f: {
  id: number;
  tipo: ModeracionCaso["tipo"];
  entidad: string;
  entidadId: number;
  detalle: string | null;
  estado: ModeracionCaso["estado"];
  asignadoId: number | null;
  asignadoNombre: string | null;
  creadoEn: Date;
  resueltoEn: Date | null;
}): ModeracionCaso {
  return {
    id: f.id,
    tipo: f.tipo,
    entidad: f.entidad,
    entidadId: f.entidadId,
    detalle: f.detalle,
    estado: f.estado,
    asignadoA: f.asignadoId !== null ? { id: f.asignadoId, nombre: f.asignadoNombre ?? `Usuario ${f.asignadoId}` } : null,
    creadoEn: f.creadoEn,
    resueltoEn: f.resueltoEn
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
const parseJson = (v: unknown): Record<string, unknown> => {
  const x = typeof v === "string" ? safeParse(v) : v;
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
};

// Implementacion Drizzle/MySQL del puerto ModeracionRepository.
export class DrizzleModeracionRepository implements ModeracionRepository {
  constructor(private readonly db: DbClient) {}

  private base() {
    return this.db.select(seleccion).from(moderacionCaso).leftJoin(usuario, eq(moderacionCaso.asignadoA, usuario.id));
  }

  async listar(f: FiltrosCasos) {
    const cond: SQL[] = [];
    if (f.tipo) cond.push(eq(moderacionCaso.tipo, f.tipo));
    if (f.estado) cond.push(eq(moderacionCaso.estado, f.estado));
    if (f.asignadoA === "sin_asignar") cond.push(isNull(moderacionCaso.asignadoA));
    else if (f.asignadoA !== undefined) cond.push(eq(moderacionCaso.asignadoA, f.asignadoA));
    const where = cond.length ? and(...cond) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(moderacionCaso).where(where);
    const filas = await this.base()
      .where(where)
      .orderBy(sql`(${moderacionCaso.estado} = 'abierto') desc`, asc(moderacionCaso.creadoEn), asc(moderacionCaso.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    return { items: filas.map(aCaso), total: Number(total) };
  }

  async buscarPorId(id: number) {
    const [fila] = await this.base().where(eq(moderacionCaso.id, id)).limit(1);
    return fila ? aCaso(fila) : null;
  }

  async buscarAbierto(tipo: ModeracionTipo, entidad: string, entidadId: number) {
    const [fila] = await this.base()
      .where(
        and(
          eq(moderacionCaso.tipo, tipo),
          eq(moderacionCaso.entidad, entidad),
          eq(moderacionCaso.entidadId, entidadId),
          eq(moderacionCaso.estado, "abierto")
        )
      )
      .limit(1);
    return fila ? aCaso(fila) : null;
  }

  async historial(id: number): Promise<EventoModeracion[]> {
    const filas = await this.db
      .select({
        usuarioId: auditoriaLog.usuarioId,
        usuarioNombre: usuario.nombre,
        datosDespues: auditoriaLog.datosDespues,
        creadoEn: auditoriaLog.creadoEn
      })
      .from(auditoriaLog)
      .leftJoin(usuario, eq(auditoriaLog.usuarioId, usuario.id))
      .where(and(eq(auditoriaLog.entidad, "moderacion_caso"), eq(auditoriaLog.entidadId, id)))
      .orderBy(asc(auditoriaLog.creadoEn), asc(auditoriaLog.id));
    return filas.map((f) => {
      const d = parseJson(f.datosDespues);
      const nota = typeof d.nota === "string" ? d.nota : typeof d.motivo === "string" ? d.motivo : null;
      return {
        operacion: typeof d.operacion === "string" ? d.operacion : "desconocida",
        usuario: f.usuarioId !== null ? { id: f.usuarioId, nombre: f.usuarioNombre ?? `Usuario ${f.usuarioId}` } : null,
        creadoEn: f.creadoEn,
        nota,
        asignadoA: typeof d.asignadoA === "number" ? d.asignadoA : null
      };
    });
  }

  // Solo se exponen etiquetas no sensibles (razon social / nombre de producto).
  async resolverEntidad(entidad: string, entidadId: number): Promise<EntidadReferenciada | null> {
    if (entidad === "organizacion") {
      const [f] = await this.db
        .select({ n: organizacion.razonSocial })
        .from(organizacion)
        .where(eq(organizacion.id, entidadId))
        .limit(1);
      return f ? { entidad, id: entidadId, etiqueta: f.n } : null;
    }
    if (entidad === "producto") {
      const [f] = await this.db.select({ n: producto.nombre }).from(producto).where(eq(producto.id, entidadId)).limit(1);
      return f ? { entidad, id: entidadId, etiqueta: f.n } : null;
    }
    return null;
  }

  async usuariosInternos(): Promise<UsuarioInterno[]> {
    return this.db
      .select({ id: usuario.id, nombre: usuario.nombre, rol: rol.codigo })
      .from(usuario)
      .innerJoin(organizacion, eq(usuario.organizacionId, organizacion.id))
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(and(eq(organizacion.tipo, "interna"), eq(usuario.estado, "activo")))
      .orderBy(asc(usuario.nombre));
  }

  async crear(input: NuevoCaso, auditoria: (casoId: number) => RegistroAuditoria) {
    const id = await this.db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(moderacionCaso)
        .values({ tipo: input.tipo, entidad: input.entidad, entidadId: input.entidadId, detalle: input.detalle })
        .$returningId();
      await tx.insert(auditoriaLog).values(auditoria(id));
      return id;
    });
    return (await this.buscarPorId(id)) as ModeracionCaso;
  }

  async cambiar(id: number, cambio: CambioCaso, auditoria: RegistroAuditoria) {
    const aplicado = await this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ estado: moderacionCaso.estado })
        .from(moderacionCaso)
        .where(eq(moderacionCaso.id, id))
        .for("update");
      if (!actual || actual.estado !== "abierto") return false;
      const set: Partial<typeof moderacionCaso.$inferInsert> = {};
      if (cambio.estado !== undefined) set.estado = cambio.estado;
      if (cambio.asignadoA !== undefined) set.asignadoA = cambio.asignadoA;
      if (cambio.resueltoEn !== undefined) set.resueltoEn = cambio.resueltoEn;
      await tx.update(moderacionCaso).set(set).where(eq(moderacionCaso.id, id));
      await tx.insert(auditoriaLog).values(auditoria);
      return true;
    });
    return aplicado ? await this.buscarPorId(id) : null;
  }
}
