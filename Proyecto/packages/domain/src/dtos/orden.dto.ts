import { z } from "zod";

export const ORDEN_ESTADOS = ["pendiente_pago", "pagada", "en_preparacion", "despachada", "entregada", "reembolsada"] as const;
export const ORDEN_ENVIO_ESTADOS = ["por_despachar", "en_preparacion", "listo_retiro", "despachado", "entregado", "cancelado"] as const;

// ?estado= filtra por estado de la orden (cliente/admin) o del envio (proveedor); el caso de uso valida segun el perfil.
export const listarOrdenesQuerySchema = z.object({
  estado: z.string().trim().min(1).max(30).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarOrdenesQueryDto = z.infer<typeof listarOrdenesQuerySchema>;

export const cambiarEstadoEnvioSchema = z.object({ estado: z.enum(ORDEN_ENVIO_ESTADOS) });
export type CambiarEstadoEnvioDto = z.infer<typeof cambiarEstadoEnvioSchema>;
