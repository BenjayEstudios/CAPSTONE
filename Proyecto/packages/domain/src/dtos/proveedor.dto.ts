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
