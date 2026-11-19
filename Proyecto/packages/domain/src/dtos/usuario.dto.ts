import { z } from "zod";

export const MFA_ESTADOS = ["inactivo", "opcional", "pendiente", "activo"] as const;
export const USUARIO_ESTADOS = ["invitado", "activo", "suspendido"] as const;

export const listarUsuariosQuerySchema = z.object({
  rolId: z.coerce.number().int().positive().optional(),
  organizacionId: z.coerce.number().int().positive().optional(),
  estado: z.enum(USUARIO_ESTADOS).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarUsuariosQueryDto = z.infer<typeof listarUsuariosQuerySchema>;

const texto = (max: number) => z.string().trim().min(1).max(max);

export const crearUsuarioSchema = z.object({
  nombre: texto(120),
  email: z.string().trim().toLowerCase().email().max(160),
  rolId: z.number().int().positive(),
  organizacionId: z.number().int().positive(),
  rut: texto(12).nullish(),
  telefono: texto(24).nullish(),
  modo: z.enum(["invitacion", "clave_temporal"]),
  mfa: z.enum(["opcional", "activo"]).optional()
});
export type CrearUsuarioDto = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z
  .object({
    nombre: texto(120).optional(),
    rolId: z.number().int().positive().optional(),
    organizacionId: z.number().int().positive().optional(),
    telefono: texto(24).nullable().optional(),
    mfaEstado: z.enum(MFA_ESTADOS).optional()
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Indica al menos un campo a modificar" });
export type ActualizarUsuarioDto = z.infer<typeof actualizarUsuarioSchema>;
