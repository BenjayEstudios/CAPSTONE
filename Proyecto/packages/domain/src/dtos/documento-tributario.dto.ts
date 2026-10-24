import { z } from "zod";

export const TIPOS_DTE = [33, 39, 52, 61] as const;

// ?ordenId=&tipo=&pagina=&tamano= (KAN-153)
export const listarDocumentosQuerySchema = z.object({
  ordenId: z.coerce.number().int().positive().optional(),
  tipo: z.coerce.number().int().refine((v) => (TIPOS_DTE as readonly number[]).includes(v), "tipo: debe ser 33, 39, 52 o 61").optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarDocumentosQueryDto = z.infer<typeof listarDocumentosQuerySchema>;

// POST /ordenes/:id/reembolsos (KAN-120): monto omitido = reembolso total del saldo.
export const crearReembolsoSchema = z.object({
  monto: z.number().int().positive().optional(),
  motivo: z.string().trim().min(1).max(300)
});
export type CrearReembolsoDto = z.infer<typeof crearReembolsoSchema>;

export const buscarReembolsoQuerySchema = z.object({ codigo: z.string().trim().min(1).max(16) });
