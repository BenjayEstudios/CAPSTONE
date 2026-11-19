import { z } from "zod";

// Parametro de ruta ":id" (entero positivo). Si es invalido el parse lanza
// ZodError y el error handler de Fastify responde 400 VALIDACION.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export type IdParamDto = z.infer<typeof idParamSchema>;
