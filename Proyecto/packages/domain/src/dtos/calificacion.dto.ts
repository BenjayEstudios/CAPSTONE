import { z } from "zod";

// Entrada para calificar un envio. usuarioId sale del token (no del body);
// el resto lo manda el cliente.
export const registrarCalificacionSchema = z.object({
  ordenEnvioId: z.number().int().positive(),
  usuarioId: z.number().int().positive(),
  puntaje: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(500).nullable().optional()
});

export type RegistrarCalificacionDto = z.infer<typeof registrarCalificacionSchema>;
