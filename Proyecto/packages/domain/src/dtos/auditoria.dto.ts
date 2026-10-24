import { z } from "zod";
import { ACCIONES_AUDITORIA } from "../entities/auditoria.entity.js";

// "" (selects sin valor) se trata como filtro ausente.
const vacioAUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const fechaIso = z.preprocess(
  vacioAUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (usa yyyy-mm-dd)")
    .refine((s) => {
      const d = new Date(`${s}T00:00:00.000Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
    }, "Fecha invalida")
    .optional()
);

export const listarAuditoriaQuerySchema = z
  .object({
    entidad: z.preprocess(vacioAUndefined, z.string().trim().min(1).max(60).optional()),
    accion: z.preprocess(vacioAUndefined, z.enum(ACCIONES_AUDITORIA).optional()),
    usuarioId: z.preprocess(vacioAUndefined, z.coerce.number().int().positive().optional()),
    desde: fechaIso,
    hasta: fechaIso,
    pagina: z.coerce.number().int().min(1).default(1),
    tamano: z.coerce.number().int().min(1).max(100).default(20)
  })
  .superRefine((v, ctx) => {
    if (v.desde && v.hasta && v.desde > v.hasta) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: "hasta no puede ser anterior a desde" });
    }
  });
export type ListarAuditoriaQueryDto = z.infer<typeof listarAuditoriaQuerySchema>;
