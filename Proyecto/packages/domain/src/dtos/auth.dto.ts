import { z } from "zod";
import type { PermisosRol } from "../entities/rol.entity.js";

// Entrada de POST /auth/admin/login. Compartido por la ruta y el caso de uso.
export const loginAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  clave: z.string().min(1).max(200)
});

export type LoginAdminDto = z.infer<typeof loginAdminSchema>;

// Salida: datos del usuario autenticado (nunca incluye hashClave).
// rol = codigo del rol; permisos = matriz { codigo_permiso: nivel }.
export interface UsuarioSesionDto {
  id: number;
  nombre: string;
  email: string;
  organizacionId: number;
  rol: string;
  permisos: PermisosRol;
}

// Claims que el backend firma en el JWT (ver apps/backend/src/plugins/auth.ts).
// domain/application no conocen JWT: solo reciben una funcion que firma.
export interface TokenClaims {
  sub: string;
  organizacionId: number;
  rol: string;
}

export interface LoginAdminResultadoDto {
  token: string;
  usuario: UsuarioSesionDto;
}

// ---- 2FA por correo (KAN-112) ----
// Paso 2: desafio firmado (JWT corto) + codigo de 6 digitos.
export const verificarMfaSchema = z.object({
  desafio: z.string().min(10).max(2000),
  codigo: z.string().trim().regex(/^\d{6}$/)
});
export type VerificarMfaDto = z.infer<typeof verificarMfaSchema>;

export const reenviarMfaSchema = z.object({ desafio: z.string().min(10).max(2000) });
export type ReenviarMfaDto = z.infer<typeof reenviarMfaSchema>;

// Claims del desafio MFA. hash = HMAC-SHA256(secreto, sub + ":" + codigo).
export interface DesafioMfaClaims {
  sub: string;
  tipo: "mfa";
  hash: string;
  jti: string;
}

export interface MfaRequeridoDto {
  mfaRequerido: true;
  desafio: string;
}

export type LoginAdminRespuestaDto = LoginAdminResultadoDto | MfaRequeridoDto;
