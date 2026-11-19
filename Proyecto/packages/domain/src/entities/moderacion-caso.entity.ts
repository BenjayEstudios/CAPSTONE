// Ver DataBase/dbDiagram.sql -> Table moderacion_caso (cola del panel de administracion).
export const TIPOS_MODERACION = ["alta_proveedor", "ficha_duplicada", "precio_fuera_rango", "reembolso"] as const;
export type ModeracionTipo = (typeof TIPOS_MODERACION)[number];
export const ESTADOS_MODERACION = ["abierto", "resuelto", "descartado"] as const;
export type ModeracionEstado = (typeof ESTADOS_MODERACION)[number];

export interface UsuarioModeracion {
  id: number;
  nombre: string;
}

export interface ModeracionCaso {
  id: number;
  tipo: ModeracionTipo;
  entidad: string;
  entidadId: number;
  detalle: string | null;
  estado: ModeracionEstado;
  asignadoA: UsuarioModeracion | null;
  creadoEn: Date;
  resueltoEn: Date | null;
}

/** Evento del caso, tomado de auditoria_log (entidad = "moderacion_caso"). */
export interface EventoModeracion {
  operacion: string;
  usuario: UsuarioModeracion | null;
  creadoEn: Date;
  /** nota de resolucion / motivo de descarte / asignado (solo texto de negocio). */
  nota: string | null;
  asignadoA: number | null;
}

export interface EntidadReferenciada {
  entidad: string;
  id: number;
  etiqueta: string | null;
}

export interface UsuarioInterno {
  id: number;
  nombre: string;
  rol: string;
}
