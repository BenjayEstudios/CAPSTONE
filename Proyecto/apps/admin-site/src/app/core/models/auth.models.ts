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

// Paso 1 con 2FA (TOTP): no hay token, solo un desafio firmado.
// enrolar = true si el usuario todavia no configuro su app autenticadora.
export interface MfaRequeridoResponse {
  mfaRequerido: true;
  enrolar: boolean;
  desafio: string;
}

// POST /auth/admin/mfa/enrolar: QR para la app y desafio para confirmar.
export interface EnrolamientoMfaResponse {
  secreto: string;
  otpauthUrl: string;
  qrDataUrl: string;
  desafio: string;
}

export type LoginRespuesta = LoginResponse | MfaRequeridoResponse;

export interface MeResponse {
  usuario: UsuarioSesion;
}

// Forma de error del backend: { error: { code, message } }
export interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export const ROL_ADMINISTRADOR = "administrador";
