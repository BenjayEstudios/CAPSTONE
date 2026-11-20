// Contrato de /auth/* (apps/backend, KAN-144). Ver apps/backend/README.md.

export type NivelPermiso = "ninguno" | "parcial" | "total";
export type TipoOrganizacion = "cliente" | "proveedor" | "interna";

export interface OrganizacionSesion {
  id: number;
  nombre: string;
  tipo: TipoOrganizacion;
}

export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  organizacionId: number;
  rol: string;
  permisos: Record<string, NivelPermiso>;
  organizacion: OrganizacionSesion;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioSesion;
}

// Solo los internos con 2FA reciben esto; el ecommerce no los deja entrar.
export interface MfaRequeridoResponse {
  mfaRequerido: true;
  enrolar: boolean;
  desafio: string;
}

export interface EmpresaRegistro {
  razonSocial: string;
  rut: string;
  nombreFantasia?: string;
  giro?: string;
}

export interface RegistroCompradorRequest {
  nombre: string;
  email: string;
  clave: string;
  rut: string;
  telefono?: string;
  empresa?: EmpresaRegistro;
}

// GET /auth/me devuelve el usuario sin la organizacion.
export type MeResponse = Omit<UsuarioSesion, "organizacion">;

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}
