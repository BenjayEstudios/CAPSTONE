import { z } from "zod";

// Schema de validacion de entrada para crear una categoria. Se usa tanto en
// el caso de uso (packages/application) como en la ruta HTTP (apps/backend),
// para no duplicar reglas de validacion en las dos capas.
// El slug es un identificador URL: minusculas, numeros y guiones.
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug invalido: usa minusculas, numeros y guiones");

export const crearCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  slug: slugSchema,
  padreId: z.number().int().positive().nullable().optional(),
  orden: z.number().int().min(0).max(32767).nullable().optional()
});

export type CrearCategoriaDto = z.infer<typeof crearCategoriaSchema>;

// PATCH /categorias/:id: todos los campos opcionales, al menos uno.
export const actualizarCategoriaSchema = z
  .object({
    nombre: z.string().trim().min(1).max(80),
    slug: slugSchema,
    padreId: z.number().int().positive().nullable(),
    orden: z.number().int().min(0).max(32767).nullable(),
    estado: z.enum(["activa", "oculta"])
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Debes enviar al menos un campo");

export type ActualizarCategoriaDto = z.infer<typeof actualizarCategoriaSchema>;

// Query de GET /categorias. incluirOcultas solo lo honra el administrador;
// arbol=true devuelve { ...categoria, hijos: [...] } en vez de lista plana.
const boolQuery = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

export const listarCategoriasQuerySchema = z.object({
  incluirOcultas: boolQuery.optional(),
  arbol: boolQuery.optional()
});

export type ListarCategoriasQueryDto = z.infer<typeof listarCategoriasQuerySchema>;
