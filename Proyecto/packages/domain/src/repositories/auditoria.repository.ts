import type { AccionAuditoria, RegistroAuditoriaLog, UsuarioAuditoria } from "../entities/auditoria.entity.js";

export interface FiltrosAuditoria {
  entidad?: string;
  accion?: AccionAuditoria;
  usuarioId?: number;
  /** Inclusivo. */
  desde?: Date;
  /** Exclusivo (medianoche del dia siguiente a `hasta`). */
  hastaExclusivo?: Date;
  pagina: number;
  tamano: number;
}

// Puerto de SOLO LECTURA sobre auditoria_log (la escritura ocurre dentro de las transacciones de cada modulo).
export interface AuditoriaRepository {
  /** Orden: creadoEn descendente, luego id descendente. */
  listar(f: FiltrosAuditoria): Promise<{ items: RegistroAuditoriaLog[]; total: number }>;
  buscarPorId(id: number): Promise<RegistroAuditoriaLog | null>;
  entidadesDistintas(): Promise<string[]>;
  usuariosEnLog(): Promise<UsuarioAuditoria[]>;
}
