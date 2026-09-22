import { z } from "zod";

// Schema de validacion de entrada para crear una categoria. Se usa tanto en
// el caso de uso (packages/application) como en la ruta HTTP (apps/rest),
// para no duplicar reglas de validacion en las dos capas.
export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1).max(80),
  slug: z.string().min(1).max(80),
  padreId: z.number().int().positive().nullable().optional(),
  orden: z.number().int().nullable().optional()
});

export type CrearCategoriaDto = z.infer<typeof crearCategoriaSchema>;
