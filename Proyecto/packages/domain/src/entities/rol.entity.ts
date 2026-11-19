export type NivelPermiso = "ninguno" | "parcial" | "total";

// Matriz completa { codigo_permiso: nivel }; el catalogo de codigos validos
// (crear_producto, aprobar_proveedor, ...) se mantiene en aplicacion.
export type PermisosRol = Record<string, NivelPermiso>;

// Entidad de dominio: forma pura del rol. Ver DataBase/dbDiagram.sql -> Table rol.
export interface Rol {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  permisos: PermisosRol;
  permisosActualizadoPor: number | null;
  permisosActualizadoEn: Date | null;
}
