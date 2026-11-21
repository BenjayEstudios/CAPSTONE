import type { RouteOptions } from "fastify";
import { z } from "zod";
import { ErrorAplicacion, importarProductos } from "@cotizapp/application";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { leerPlanilla } from "../../lib/planilla-productos.js";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// ?simular=true (por defecto) solo valida y devuelve el resultado fila a fila;
// ?simular=false aplica. El SKU es la llave: existente -> actualiza, nuevo -> crea.
const querySchema = z.object({
  simular: z.enum(["true", "false"]).default("true")
});

// Mismo permiso que crear/editar productos (cada fila deja su registro de auditoria).
export const importProductosRoute: RouteOptions = {
  method: "POST",
  url: "/productos/importar",
  preHandler: [requireAuth, requirePermiso("crear_producto")],
  handler: async (request) => {
    const { simular } = querySchema.parse(request.query);
    const parte = await request.file();
    if (!parte) throw new ErrorAplicacion(400, "ARCHIVO_REQUERIDO", "Falta la planilla (multipart/form-data)");
    if (!parte.filename.toLowerCase().endsWith(".xlsx")) {
      throw new ErrorAplicacion(400, "ARCHIVO_INVALIDO", "La planilla debe ser un archivo .xlsx");
    }
    // toBuffer lanza 413 FST_REQ_FILE_TOO_LARGE si supera limits.fileSize.
    const filas = await leerPlanilla(await parte.toBuffer());

    const db = request.server.db;
    return importarProductos({
      productoRepository: new DrizzleProductoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(filas, Number(request.auth?.sub), { simular: simular === "true" });
  }
};
