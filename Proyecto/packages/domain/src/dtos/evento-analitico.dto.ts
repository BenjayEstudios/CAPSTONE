import { z } from "zod";

// Ingesta publica y anonima: todo estricto (campos extra -> 400) y con limites de largo.
// Las claves del body van en snake_case, igual que las columnas del DBML (evento_analitico).
const sesionId = z.string().regex(/^[A-Za-z0-9_-]{8,36}$/, "sesion_id invalido (8-36 caracteres alfanumericos, _ o -)");
const idPositivo = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const vistaProducto = z
  .object({
    tipo_evento: z.literal("vista_producto"),
    sesion_id: sesionId,
    producto_id: idPositivo,
    origen: z.enum(["catalogo", "busqueda", "directo"]).optional(),
    comuna_id: z.number().int().positive().max(32767).optional()
  })
  .strict();

const clickOferta = z
  .object({
    tipo_evento: z.literal("click_oferta"),
    sesion_id: sesionId,
    producto_id: idPositivo,
    oferta_id: idPositivo,
    convirtio: z.boolean().optional(),
    comuna_id: z.number().int().positive().max(32767).optional()
  })
  .strict();

const busqueda = z
  .object({
    tipo_evento: z.literal("busqueda"),
    sesion_id: sesionId,
    // Se normaliza (espacios colapsados, minusculas) para poder agrupar terminos.
    termino: z
      .string()
      .transform((s) => s.trim().replace(/\s+/g, " ").toLowerCase())
      .pipe(z.string().min(1, "termino vacio").max(160)),
    resultados: z.number().int().min(0).max(65535).optional(),
    comuna_id: z.number().int().positive().max(32767).optional()
  })
  .strict();

export const eventoEntradaSchema = z.discriminatedUnion("tipo_evento", [vistaProducto, clickOferta, busqueda]);
export type EventoEntradaDto = z.infer<typeof eventoEntradaSchema>;

export const MAX_EVENTOS_LOTE = 20;
export const eventoLoteSchema = z.object({ eventos: z.array(eventoEntradaSchema).min(1).max(MAX_EVENTOS_LOTE) }).strict();

// ---- Estadisticas ----
export const MAX_DIAS_RANGO_ESTADISTICAS = 366;

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida (usa yyyy-mm-dd)")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "Fecha invalida");

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// desde/hasta opcionales (por defecto, ultimos 30 dias); ambos inclusivos.
export const estadisticasQuerySchema = z
  .object({ desde: z.preprocess(vacio, fechaIso.optional()), hasta: z.preprocess(vacio, fechaIso.optional()) })
  .superRefine((v, ctx) => {
    if (v.desde && v.hasta && v.desde > v.hasta) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: "hasta no puede ser anterior a desde" });
    }
  });
export type EstadisticasQueryDto = z.infer<typeof estadisticasQuerySchema>;
