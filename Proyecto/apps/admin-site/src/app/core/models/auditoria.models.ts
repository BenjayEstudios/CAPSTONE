export type AccionAuditoria = "crear" | "editar" | "eliminar" | "aprobar" | "suspender" | "reembolsar";

export interface UsuarioAuditoria {
  id: number;
  nombre: string;
}

export interface RegistroAuditoriaItem {
  id: number;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: number;
  usuario: UsuarioAuditoria | null;
  creadoEn: string;
  operacion?: string;
}

export interface RegistroAuditoriaDetalle extends RegistroAuditoriaItem {
  datosAntes: unknown;
  datosDespues: unknown;
}

export interface AuditoriaListadoRespuesta {
  items: RegistroAuditoriaItem[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosAuditoriaOpciones {
  acciones: AccionAuditoria[];
  entidades: string[];
  usuarios: UsuarioAuditoria[];
}

export interface FiltrosAuditoria {
  entidad?: string;
  accion?: string;
  usuarioId?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
  tamano?: number;
}
