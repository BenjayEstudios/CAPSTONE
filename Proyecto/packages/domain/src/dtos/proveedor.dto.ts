import { z } from "zod";

export const listarProveedoresQuerySchema = z.object({
  estado: z.enum(["en_revision", "activa", "suspendida"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarProveedoresQueryDto = z.infer<typeof listarProveedoresQuerySchema>;

export const documentoParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  documentoId: z.coerce.number().int().positive()
});

const motivo = z.string().trim().min(1, "El motivo es obligatorio").max(240);

export const revisarDocumentoSchema = z
  .object({ decision: z.enum(["aprobado", "rechazado"]), motivo: motivo.optional() })
  .superRefine((v, ctx) => {
    if (v.decision === "rechazado" && !v.motivo) {
      ctx.addIssue({ code: "custom", path: ["motivo"], message: "El motivo es obligatorio al rechazar" });
    }
  });
export type RevisarDocumentoDto = z.infer<typeof revisarDocumentoSchema>;

export const aprobarProveedorSchema = z.object({ comisionPct: z.number().min(0).max(100).optional() });
export type AprobarProveedorDto = z.infer<typeof aprobarProveedorSchema>;

export const motivoProveedorSchema = z.object({ motivo });
export type MotivoProveedorDto = z.infer<typeof motivoProveedorSchema>;

// PATCH /proveedor/perfil (KAN-108): lo que el proveedor edita de su perfil.
// Razon social y RUT no: salen en los documentos tributarios y se validaron
// al aprobar la cuenta. Una direccion nueva no pisa la anterior (la pueden
// citar ordenes y retiros pasados): el repositorio inserta otra fila.
/** Texto que se puede borrar: "" se guarda como null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));
export const direccionPerfilSchema = z.object({
  calle: z.string().trim().min(1).max(160),
  numero: textoOpcional(20),
  complemento: textoOpcional(80),
  comunaId: z.number().int().positive()
});
export const actualizarPerfilProveedorSchema = z
  .object({
    nombreFantasia: z.string().trim().min(1).max(180).optional(),
    giro: textoOpcional(180),
    emailContacto: z.string().trim().email().max(160).optional(),
    telefono: textoOpcional(24),
    direccion: direccionPerfilSchema.optional(),
    bodega: direccionPerfilSchema.extend({ nombre: z.string().trim().min(1).max(120), horario: textoOpcional(180) }).optional(),
    plazoEstandarHoras: z.number().int().min(1).max(720).optional(),
    plazoFueraRegionHoras: z.number().int().min(1).max(720).nullable().optional(),
    horaCorte: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "formato HH:MM").nullable().optional(),
    despachoGratisDesde: z.number().int().min(0).max(100_000_000).nullable().optional(),
    ofreceDespacho: z.boolean().optional(),
    ofreceRetiro: z.boolean().optional(),
    banco: textoOpcional(60),
    cuentaBancaria: z
      .string()
      .trim()
      .regex(/^[0-9][0-9-]{3,39}$/, "solo numeros y guiones")
      .nullable()
      .optional()
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, "No hay cambios");
export type ActualizarPerfilProveedorDto = z.infer<typeof actualizarPerfilProveedorSchema>;
