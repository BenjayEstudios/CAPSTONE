import { z } from "zod";

// Reglas de formato compartidas por crear/actualizar.
const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(24)
  .regex(/^[A-Z0-9._-]+$/, "sku invalido: letras, numeros, punto, guion y guion bajo");
const eanSchema = z.string().trim().regex(/^\d{8,14}$/, "ean invalido: 8 a 14 digitos");
const texto = (max: number) => z.string().trim().min(1).max(max);

const campos = {
  nombre: z.string().trim().min(1).max(180),
  sku: skuSchema,
  ean: eanSchema.nullable(),
  categoriaId: z.number().int().positive(),
  marca: texto(80).nullable(),
  formato: texto(80).nullable(),
  contenido: z.number().positive().max(9999999.999).nullable(),
  unidad: z.enum(["kg", "L", "unidad"]),
  descripcion: texto(5000).nullable(),
  // CLP enteros (columna "int unsigned" del DBML).
  precioReferencia: z.number().int().positive().max(4294967295).nullable(),
  // Tope de publicacion sobre el precio de referencia, en % (0 = sin margen).
  topeSobreReferenciaPct: z.number().int().min(0).max(100).nullable(),
  estado: z.enum(["borrador", "publicado", "archivado"])
};

export const crearProductoSchema = z.object({
  nombre: campos.nombre,
  sku: campos.sku,
  ean: campos.ean.optional(),
  categoriaId: campos.categoriaId,
  marca: campos.marca.optional(),
  formato: campos.formato.optional(),
  contenido: campos.contenido.optional(),
  unidad: campos.unidad,
  descripcion: campos.descripcion.optional(),
  precioReferencia: campos.precioReferencia.optional(),
  topeSobreReferenciaPct: campos.topeSobreReferenciaPct.optional(),
  estado: campos.estado.default("borrador")
});

export type CrearProductoDto = z.infer<typeof crearProductoSchema>;

export const actualizarProductoSchema = z
  .object(campos)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Debes enviar al menos un campo");

export type ActualizarProductoDto = z.infer<typeof actualizarProductoSchema>;

// Query de GET /productos.
export const listarProductosQuerySchema = z.object({
  estado: z.enum(["borrador", "publicado", "archivado"]).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});

export type ListarProductosQueryDto = z.infer<typeof listarProductosQuerySchema>;

// PUT /productos/:id/imagenes: reemplaza la lista completa (metadatos; la
// subida de archivos aun no existe). Exactamente una principal. ancho/alto
// son opcionales; si se informa ancho debe ser >= 1200 px.
export const ANCHO_MINIMO_IMAGEN = 1200;

export const imagenProductoInputSchema = z.object({
  url: z.string().trim().url().max(2048),
  textoAlt: z.string().trim().max(200).nullable().optional(),
  esPrincipal: z.boolean().default(false),
  orden: z.number().int().min(0).max(1000).optional(),
  ancho: z.number().int().min(ANCHO_MINIMO_IMAGEN, `El ancho minimo es ${ANCHO_MINIMO_IMAGEN}px`).optional(),
  alto: z.number().int().positive().optional()
});

export const reemplazarImagenesSchema = z.object({
  imagenes: z.array(imagenProductoInputSchema).max(10)
});

export type ReemplazarImagenesDto = z.infer<typeof reemplazarImagenesSchema>;
