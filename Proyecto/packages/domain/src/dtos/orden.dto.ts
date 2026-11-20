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

// POST /ordenes/:id/pago (KAN-95). Hoy solo "tarjeta" pasa por la pasarela
// (Webpay: credito, debito y prepago); transferencia y linea de credito
// responden 409 MEDIO_PAGO_NO_DISPONIBLE (ver DECISIONES-ABIERTAS).
export const MEDIOS_PAGO = ["tarjeta", "transferencia", "linea_credito"] as const;
export const iniciarPagoSchema = z.object({ medioPago: z.enum(MEDIOS_PAGO).default("tarjeta") });
export type IniciarPagoDto = z.infer<typeof iniciarPagoSchema>;

// Lo que la pasarela devuelve al comprador en la URL de retorno (Webpay Plus):
// token_ws en el flujo normal (aprobado o rechazado); TBK_TOKEN si el
// comprador anulo; solo TBK_ORDEN_COMPRA/TBK_ID_SESION si se agoto el tiempo.
export const retornoWebpaySchema = z.object({
  token_ws: z.string().trim().min(1).max(64).optional(),
  TBK_TOKEN: z.string().trim().min(1).max(64).optional(),
  TBK_ORDEN_COMPRA: z.string().trim().min(1).max(26).optional(),
  TBK_ID_SESION: z.string().trim().min(1).max(61).optional()
});
export type RetornoWebpayDto = z.infer<typeof retornoWebpaySchema>;
