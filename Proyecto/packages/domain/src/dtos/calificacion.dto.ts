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

// Body de POST /ordenes/envios/:id/calificacion (KAN-99): el envio sale de la
// ruta y el usuario del token. Un comentario vacio se guarda como null.
export const calificarEnvioSchema = z.object({
  puntaje: z.number().int().min(1).max(5),
  comentario: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((c) => (c ? c : null))
});

export type CalificarEnvioDto = z.infer<typeof calificarEnvioSchema>;

// GET /calificaciones/recibidas (KAN-200): paginacion del listado.
export const calificacionesRecibidasQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type CalificacionesRecibidasQueryDto = z.infer<typeof calificacionesRecibidasQuerySchema>;
