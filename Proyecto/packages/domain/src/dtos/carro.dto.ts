import { z } from "zod";

// PUT /carro: reemplaza los items. La unicidad por ofertaId se valida en el caso de uso.
export const reemplazarCarroSchema = z.object({
  items: z
    .array(
      z.object({
        ofertaId: z.number().int().positive(),
        cantidad: z.number().int().min(1).max(100000),
        precioVisto: z.number().int().min(0)
      })
    )
    .max(100)
});
export type ReemplazarCarroDto = z.infer<typeof reemplazarCarroSchema>;

const direccionNuevaSchema = z.object({
  comunaId: z.number().int().positive(),
  calle: z.string().trim().min(1).max(160),
  numero: z.string().trim().max(20).optional(),
  complemento: z.string().trim().max(80).optional(),
  referencia: z.string().trim().max(240).optional()
});
export type DireccionNuevaDto = z.infer<typeof direccionNuevaSchema>;

// POST /carro/confirmar: direccion de despacho (existente o nueva) y, opcionalmente,
// proveedores cuyo tramo se retira en un punto de retiro en vez de despacharse.
export const confirmarCarroSchema = z.object({
  direccionId: z.number().int().positive().optional(),
  direccion: direccionNuevaSchema.optional(),
  retiros: z
    .array(z.object({ proveedorId: z.number().int().positive(), puntoRetiroId: z.number().int().positive() }))
    .max(50)
    .default([]),
  requiereFactura: z.boolean().default(false)
});
export type ConfirmarCarroDto = z.infer<typeof confirmarCarroSchema>;
