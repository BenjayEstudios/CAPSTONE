export type NivelPermiso = "ninguno" | "parcial" | "total";
export type Permisos = Record<string, NivelPermiso>;

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  organizacionId: string;
  rol: string;
  permisos: Permisos;
}

export interface LoginRequest {
  email: string;
  clave: string;
}

export interface LoginResponse {
  token: string;
  usuario: UsuarioSesion;
}

export interface MeResponse {
  usuario: UsuarioSesion;
}

// Forma de error del backend: { error: { code, message } }
export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export const ROL_ADMINISTRADOR = "administrador";
