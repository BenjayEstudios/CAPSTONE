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

// ---- 2FA TOTP para usuarios internos (KAN-144, reemplaza el codigo por correo de KAN-112) ----
const desafio = z.string().min(10).max(4000);
const codigoTotp = z.string().trim().regex(/^\d{6}$/);

// Paso 2 (usuario ya enrolado): desafio + codigo de la app autenticadora.
export const verificarMfaSchema = z.object({ desafio, codigo: codigoTotp });
export type VerificarMfaDto = z.infer<typeof verificarMfaSchema>;

// Enrolamiento, paso a: con el desafio de enrolamiento se pide el QR.
export const iniciarEnrolamientoMfaSchema = z.object({ desafio });
export type IniciarEnrolamientoMfaDto = z.infer<typeof iniciarEnrolamientoMfaSchema>;

// Enrolamiento, paso b: desafio de confirmacion + primer codigo de la app.
export const confirmarEnrolamientoMfaSchema = z.object({ desafio, codigo: codigoTotp });
export type ConfirmarEnrolamientoMfaDto = z.infer<typeof confirmarEnrolamientoMfaSchema>;

// Claims de los desafios (JWT cortos firmados por el backend):
// - "mfa": el usuario ya tiene secreto; falta el codigo.
// - "mfa_enrolamiento": 2FA exigido sin secreto; debe enrolarse antes de tener sesion.
// - "mfa_confirmacion": ya vio el QR; falta el primer codigo para activar.
export interface DesafioMfaClaims {
  sub: string;
  tipo: "mfa" | "mfa_enrolamiento" | "mfa_confirmacion";
  jti: string;
}

// Paso 1 con 2FA: sin token. enrolar = true si el usuario todavia no configuro su app.
export interface MfaRequeridoDto {
  mfaRequerido: true;
  enrolar: boolean;
  desafio: string;
}

// Respuesta de POST /auth/admin/mfa/enrolar: lo que la app autenticadora necesita.
// "secreto" se muestra para ingresarlo a mano si no se puede escanear el QR.
export interface EnrolamientoMfaDto {
  secreto: string;
  otpauthUrl: string;
  qrDataUrl: string;
  desafio: string;
}

export type LoginAdminRespuestaDto = LoginAdminResultadoDto | MfaRequeridoDto;
