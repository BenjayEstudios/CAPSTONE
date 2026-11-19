import { count, eq } from "drizzle-orm";
import type { PermisosRol, Rol, RegistroAuditoria, RolListado, RolRepository } from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

type Fila = typeof rol.$inferSelect;

function toRol(f: Fila): Rol {
  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    descripcion: f.descripcion,
    esSistema: f.esSistema === 1,
    permisos: (f.permisos ?? {}) as PermisosRol,
    permisosActualizadoPor: f.permisosActualizadoPor,
    permisosActualizadoEn: f.permisosActualizadoEn
  };
}

// Implementacion Drizzle/MySQL del puerto RolRepository.
export class DrizzleRolRepository implements RolRepository {
  constructor(private readonly db: DbClient) {}

  async listar(): Promise<RolListado[]> {
    const filas = await this.db
      .select({ rol, actualizadoPorNombre: usuario.nombre })
      .from(rol)
      .leftJoin(usuario, eq(rol.permisosActualizadoPor, usuario.id))
      .orderBy(rol.id);
    const conteos = await this.db.select({ rolId: usuario.rolId, n: count() }).from(usuario).groupBy(usuario.rolId);
    const porRol = new Map(conteos.map((c) => [c.rolId, Number(c.n)]));
    return filas.map((f) => ({
      ...toRol(f.rol),
      usuariosAfectados: porRol.get(f.rol.id) ?? 0,
      permisosActualizadoPorNombre: f.actualizadoPorNombre ?? null
    }));
  }

  async buscarPorId(id: number): Promise<Rol | null> {
    const [f] = await this.db.select().from(rol).where(eq(rol.id, id)).limit(1);
    return f ? toRol(f) : null;
  }

  async actualizarPermisos(id: number, permisos: PermisosRol, usuarioId: number, auditoria: RegistroAuditoria): Promise<Rol> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(rol)
        .set({ permisos, permisosActualizadoPor: usuarioId, permisosActualizadoEn: new Date() })
        .where(eq(rol.id, id));
      await tx.insert(auditoriaLog).values(auditoria);
    });
    return (await this.buscarPorId(id)) as Rol;
  }
}
