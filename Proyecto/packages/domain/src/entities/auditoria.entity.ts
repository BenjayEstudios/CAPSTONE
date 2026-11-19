export const ACCIONES_AUDITORIA = ["crear", "editar", "eliminar", "aprobar", "suspender", "reembolsar"] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export interface UsuarioAuditoria {
  id: number;
  nombre: string;
}

// Fila de auditoria_log con el usuario resuelto. Los JSON llegan crudos desde
// la BD: el caso de uso enmascara campos sensibles antes de responder.
export interface RegistroAuditoriaLog {
  id: number;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: number;
  usuario: UsuarioAuditoria | null;
  creadoEn: Date;
  datosAntes: unknown;
  datosDespues: unknown;
}
