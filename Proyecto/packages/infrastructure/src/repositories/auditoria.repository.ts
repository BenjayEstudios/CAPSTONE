import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import type { AuditoriaRepository, FiltrosAuditoria, RegistroAuditoriaLog } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

// Solo se seleccionan columnas de auditoria_log y usuario.nombre (nunca hash_clave ni ip).
const seleccion = {
  id: auditoriaLog.id,
  accion: auditoriaLog.accion,
  entidad: auditoriaLog.entidad,
  entidadId: auditoriaLog.entidadId,
  usuarioId: auditoriaLog.usuarioId,
  usuarioNombre: usuario.nombre,
  datosAntes: auditoriaLog.datosAntes,
  datosDespues: auditoriaLog.datosDespues,
  creadoEn: auditoriaLog.creadoEn
};

function aRegistro(f: {
  id: number;
  accion: RegistroAuditoriaLog["accion"];
  entidad: string;
  entidadId: number;
  usuarioId: number | null;
  usuarioNombre: string | null;
  datosAntes: unknown;
  datosDespues: unknown;
  creadoEn: Date;
}): RegistroAuditoriaLog {
  return {
    id: f.id,
    accion: f.accion,
    entidad: f.entidad,
    entidadId: f.entidadId,
    usuario: f.usuarioId !== null ? { id: f.usuarioId, nombre: f.usuarioNombre ?? `Usuario ${f.usuarioId}` } : null,
    creadoEn: f.creadoEn,
    datosAntes: f.datosAntes,
    datosDespues: f.datosDespues
  };
}

export class DrizzleAuditoriaRepository implements AuditoriaRepository {
  constructor(private readonly db: DbClient) {}

  async listar(f: FiltrosAuditoria) {
    const cond: SQL[] = [];
    if (f.entidad) cond.push(eq(auditoriaLog.entidad, f.entidad));
    if (f.accion) cond.push(eq(auditoriaLog.accion, f.accion));
    if (f.usuarioId) cond.push(eq(auditoriaLog.usuarioId, f.usuarioId));
    if (f.desde) cond.push(gte(auditoriaLog.creadoEn, f.desde));
    if (f.hastaExclusivo) cond.push(lt(auditoriaLog.creadoEn, f.hastaExclusivo));
    const where = cond.length ? and(...cond) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(auditoriaLog).where(where);
    const filas = await this.db
      .select(seleccion)
      .from(auditoriaLog)
      .leftJoin(usuario, eq(auditoriaLog.usuarioId, usuario.id))
      .where(where)
      .orderBy(desc(auditoriaLog.creadoEn), desc(auditoriaLog.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    return { items: filas.map(aRegistro), total };
  }

  async buscarPorId(id: number) {
    const [fila] = await this.db
      .select(seleccion)
      .from(auditoriaLog)
      .leftJoin(usuario, eq(auditoriaLog.usuarioId, usuario.id))
      .where(eq(auditoriaLog.id, id))
      .limit(1);
    return fila ? aRegistro(fila) : null;
  }

  async entidadesDistintas() {
    const filas = await this.db.selectDistinct({ entidad: auditoriaLog.entidad }).from(auditoriaLog).orderBy(auditoriaLog.entidad);
    return filas.map((f) => f.entidad);
  }

  async usuariosEnLog() {
    return this.db
      .selectDistinct({ id: usuario.id, nombre: usuario.nombre })
      .from(auditoriaLog)
      .innerJoin(usuario, eq(auditoriaLog.usuarioId, usuario.id))
      .orderBy(usuario.nombre);
  }
}
