import { z } from "zod";
import { ESTADOS_MODERACION, TIPOS_MODERACION } from "../entities/moderacion-caso.entity.js";

const vacioAUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// asignadoA: id de usuario o "sin_asignar" (casos sin asignar).
export const listarCasosQuerySchema = z.object({
  tipo: z.preprocess(vacioAUndefined, z.enum(TIPOS_MODERACION).optional()),
  estado: z.preprocess(vacioAUndefined, z.enum(ESTADOS_MODERACION).optional()),
  asignadoA: z.preprocess(
    vacioAUndefined,
    z.union([z.literal("sin_asignar"), z.coerce.number().int().positive()]).optional()
  ),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarCasosQueryDto = z.infer<typeof listarCasosQuerySchema>;

export const asignarCasoSchema = z.object({ usuarioId: z.number().int().positive().nullable() });
export const resolverCasoSchema = z.object({ nota: z.string().trim().min(1).max(500) });
export const descartarCasoSchema = z.object({ motivo: z.string().trim().min(1).max(500) });

export const abrirCasoSchema = z.object({
  tipo: z.enum(TIPOS_MODERACION),
  entidad: z.string().trim().min(1).max(60),
  entidadId: z.number().int().positive(),
  descripcion: z.string().trim().max(300).optional()
});
