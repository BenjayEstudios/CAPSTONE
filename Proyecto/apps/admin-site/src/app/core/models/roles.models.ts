import { NivelPermiso } from "./auth.models";

export interface PermisoCatalogo {
  codigo: string;
  etiqueta: string;
  descripcion?: string;
}

export interface RolMatriz {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  permisos: Record<string, NivelPermiso>;
  usuariosAfectados: number;
  permisosActualizadoPor: { id: number; nombre: string } | null;
  permisosActualizadoEn: string | null;
}

export interface RolesRespuesta {
  roles: RolMatriz[];
  catalogo: PermisoCatalogo[];
}

export interface ResultadoPermisos {
  id: number;
  permisos: Record<string, NivelPermiso>;
  cambiado: boolean;
}
