export type EstadoUsuario = "invitado" | "activo" | "suspendido";
export type MfaEstado = "inactivo" | "opcional" | "pendiente" | "activo";
export type OrdenUsuarios = "reciente" | "antiguo" | "nombre_asc" | "nombre_desc";

export interface UsuarioItem {
  id: number;
  nombre: string;
  email: string;
  rut: string | null;
  telefono: string | null;
  rol: { id: number; codigo: string; nombre: string };
  organizacion: { id: number; razonSocial: string; tipo: string };
  ultimoAcceso: string | null;
  mfaEstado: MfaEstado;
  estado: EstadoUsuario;
}

export interface UsuariosRespuesta {
  items: UsuarioItem[];
  pagina: number;
  tamano: number;
  orden: OrdenUsuarios;
  /** Conteo acotado: si `totalExacto` es false, el total real es mayor que `total`. */
  total: number;
  totalExacto: boolean;
  totalPaginas: number;
  hayMas: boolean;
}

export interface FiltrosUsuarios {
  rolId?: string;
  organizacionId?: string;
  estado?: EstadoUsuario | "";
  q?: string;
  orden?: OrdenUsuarios;
  pagina?: number;
  tamano?: number;
}

/** Solo catalogos acotados: las organizaciones se buscan con `buscarOrganizaciones`. */
export interface OpcionesUsuario {
  roles: Array<{ id: number; codigo: string; nombre: string }>;
}

export interface OrganizacionOpcion {
  id: number;
  razonSocial: string;
  rut: string;
  tipo: string;
  estado: string;
}

export interface CrearUsuarioBody {
  nombre: string;
  email: string;
  rolId: number;
  organizacionId: number;
  rut?: string;
  telefono?: string;
  modo: "invitacion" | "clave_temporal";
  mfa?: "opcional" | "activo";
}

export interface CrearUsuarioRespuesta {
  usuario: UsuarioItem;
  claveTemporal?: string;
  correoEnviado?: boolean;
}

export interface ActualizarUsuarioBody {
  nombre?: string;
  rolId?: number;
  organizacionId?: number;
  telefono?: string | null;
  mfaEstado?: MfaEstado;
}
