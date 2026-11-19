import type { PermisosRol, Rol } from "../entities/rol.entity.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

export interface RolListado extends Rol {
  usuariosAfectados: number;
  /** Nombre de quien actualizo la matriz por ultima vez (null si nunca). */
  permisosActualizadoPorNombre: string | null;
}

// Puerto de persistencia de roles y su matriz de permisos.
export interface RolRepository {
  listar(): Promise<RolListado[]>;
  buscarPorId(id: number): Promise<Rol | null>;
  /** Reemplaza la matriz y escribe la auditoria en la MISMA transaccion. */
  actualizarPermisos(id: number, permisos: PermisosRol, usuarioId: number, auditoria: RegistroAuditoria): Promise<Rol>;
}
