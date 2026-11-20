import { z } from "zod";
import type { OrganizacionTipo } from "../entities/organizacion.entity.js";
import type { UsuarioSesionDto } from "./auth.dto.js";

// ---- RUT chileno ----
// Acepta "12.345.678-5", "12345678-5" o "123456785" (DV k/K). Devuelve la
// forma canonica "12345678-5" (sin puntos, DV en mayuscula) o null si el
// digito verificador no calza (modulo 11).
export function normalizarRut(valor: string): string | null {
  const limpio = valor.replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado ? `${cuerpo}-${dv}` : null;
}

const rutSchema = z.string().trim().max(14).transform((v, ctx) => {
  const rut = normalizarRut(v);
  if (!rut) {
    ctx.addIssue({ code: "custom", message: "RUT invalido" });
    return z.NEVER;
  }
  return rut;
});

const texto = (max: number) => z.string().trim().min(1).max(max);
const email = z.string().trim().toLowerCase().email().max(160);
// Minimo 8 caracteres con al menos una letra y un numero. Tope 72: bcrypt
// ignora lo que pase de 72 bytes.
const claveNueva = z
  .string()
  .min(8, "La clave debe tener al menos 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "La clave debe tener al menos una letra")
  .regex(/\d/, "La clave debe tener al menos un numero");

// ---- POST /auth/login (comprador, proveedor e internos) ----
export const loginSchema = z.object({
  email,
  clave: z.string().min(1).max(200)
});
export type LoginDto = z.infer<typeof loginSchema>;

export interface OrganizacionSesionDto {
  id: number;
  nombre: string;
  tipo: OrganizacionTipo;
}

// Contrato de apps/mobile/API_CONTRACT.md: el usuario de la sesion incluye su
// organizacion (nombre = nombre_fantasia o razon_social).
export interface UsuarioSesionConOrgDto extends UsuarioSesionDto {
  organizacion: OrganizacionSesionDto;
}

export interface LoginResultadoDto {
  token: string;
  usuario: UsuarioSesionConOrgDto;
}

// ---- Registro ----
const empresaSchema = z.object({
  razonSocial: texto(180),
  rut: rutSchema,
  nombreFantasia: texto(180).optional(),
  giro: texto(180).optional(),
  telefono: texto(24).optional()
});

// Comprador persona (sin "empresa": la organizacion se crea con su nombre y
// su RUT) o empresa (con "empresa").
export const registroCompradorSchema = z.object({
  nombre: texto(120),
  email,
  clave: claveNueva,
  rut: rutSchema,
  telefono: texto(24).optional(),
  empresa: empresaSchema.optional()
});
export type RegistroCompradorDto = z.input<typeof registroCompradorSchema>;

// El proveedor siempre es empresa; queda en_revision hasta que un
// administrador lo apruebe (POST /proveedores/:id/aprobar).
export const registroProveedorSchema = z.object({
  nombre: texto(120),
  email,
  clave: claveNueva,
  rut: rutSchema.optional(),
  telefono: texto(24).optional(),
  empresa: empresaSchema
});
export type RegistroProveedorDto = z.input<typeof registroProveedorSchema>;

export interface RegistroProveedorResultadoDto {
  organizacionId: number;
  estado: "en_revision";
  mensaje: string;
}

// ---- Recuperacion de clave ----
export const solicitarRecuperacionSchema = z.object({ email });
export type SolicitarRecuperacionDto = z.infer<typeof solicitarRecuperacionSchema>;

export const restablecerClaveSchema = z.object({
  token: z.string().min(10).max(2000),
  clave: claveNueva
});
export type RestablecerClaveDto = z.infer<typeof restablecerClaveSchema>;

// Claims del enlace de recuperacion. huella = hash corto de hash_clave: al
// cambiar la clave la huella deja de calzar y el enlace queda usado.
export interface RecuperacionClaims {
  sub: string;
  tipo: "recuperacion";
  huella: string;
}
