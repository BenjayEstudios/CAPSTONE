export type TipoCaso = "alta_proveedor" | "ficha_duplicada" | "precio_fuera_rango" | "reembolso";
export type EstadoCaso = "abierto" | "resuelto" | "descartado";

export interface UsuarioRef {
  id: number;
  nombre: string;
}

export interface Caso {
  id: number;
  tipo: TipoCaso;
  entidad: string;
  entidadId: number;
  detalle: string | null;
  estado: EstadoCaso;
  asignadoA: UsuarioRef | null;
  creadoEn: string;
  resueltoEn: string | null;
}

export interface CasosRespuesta {
  items: Caso[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface EventoCaso {
  operacion: string;
  usuario: UsuarioRef | null;
  creadoEn: string;
  nota: string | null;
  asignadoA: number | null;
}

export interface CasoDetalle extends Caso {
  entidadReferenciada: { entidad: string; id: number; etiqueta: string | null } | null;
  asignadoPor: UsuarioRef | null;
  cierre: { operacion: string; usuario: UsuarioRef | null; creadoEn: string; nota: string | null } | null;
  historial: EventoCaso[];
}

export interface UsuarioInterno {
  id: number;
  nombre: string;
  rol: string;
}

/** asignadoA: "" = todos; "sin_asignar"; o id de usuario. */
export interface FiltrosCasos {
  tipo?: TipoCaso | "";
  estado?: EstadoCaso | "";
  asignadoA?: string | number;
  pagina?: number;
  tamano?: number;
}
