import { z } from "zod";

const fechaYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "debe tener formato YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "fecha invalida");

export const LIQUIDACION_ESTADOS = ["pendiente", "pagada"] as const;

// ?proveedorId=&estado=&desde=&hasta=&pagina=&tamano= (desde/hasta acotan el periodo de la liquidacion)
export const listarLiquidacionesQuerySchema = z.object({
  proveedorId: z.coerce.number().int().positive().optional(),
  estado: z.enum(LIQUIDACION_ESTADOS).optional(),
  desde: fechaYmd.optional(),
  hasta: fechaYmd.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});
export type ListarLiquidacionesQueryDto = z.infer<typeof listarLiquidacionesQuerySchema>;

// Sin desde: semana anterior (lunes a domingo, America/Santiago). hasta por defecto = desde + 6 dias.
export const generarLiquidacionesSchema = z.object({
  desde: fechaYmd.optional(),
  hasta: fechaYmd.optional()
});
export type GenerarLiquidacionesDto = z.infer<typeof generarLiquidacionesSchema>;

export const pagarLiquidacionSchema = z.object({ fechaPago: fechaYmd });
export type PagarLiquidacionDto = z.infer<typeof pagarLiquidacionSchema>;
