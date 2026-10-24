export type UsuarioMfaEstado = "activo" | "pendiente" | "opcional" | "inactivo";
export type UsuarioEstado = "activo" | "invitado" | "suspendido";

// Entidad de dominio: forma pura del usuario. Ver DataBase/dbDiagram.sql ->
// Table usuario. Cuenta de acceso: una organizacion, un rol. hashClave nunca
// debe salir en respuestas HTTP (los DTO de salida deben omitirlo).
export interface Usuario {
  id: number;
  organizacionId: number;
  rolId: number;
  nombre: string;
  email: string;
  rut: string | null;
  telefono: string | null;
  hashClave: string;
  mfaEstado: UsuarioMfaEstado;
  ultimoAcceso: Date | null;
  estado: UsuarioEstado;
}
