import type { RouteOptions } from "fastify";
import { z } from "zod";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { generarPlantilla, MIME_XLSX } from "../../lib/planilla-productos.js";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

const querySchema = z.object({
  // true = la hoja Productos viene con todo el catalogo actual, lista para editar y volver a subir.
  conProductos: z.enum(["true", "false"]).default("false")
});

// Descarga la plantilla Excel de carga masiva (hoja Productos + Instrucciones + Categorias vigentes).
export const plantillaImportacionRoute: RouteOptions = {
  method: "GET",
  url: "/productos/plantilla-importacion",
  preHandler: [requireAuth, requirePermiso("crear_producto")],
  handler: async (request, reply) => {
    const { conProductos } = querySchema.parse(request.query);
    const db = request.server.db;
    const categorias = await new DrizzleCategoriaRepository(db).listar();
    const productos = conProductos === "true" ? await new DrizzleProductoRepository(db).listarTodos() : [];
    const archivo = await generarPlantilla(categorias, productos);
    const nombre = conProductos === "true" ? "catalogo-maestro-actual.xlsx" : "plantilla-catalogo-maestro.xlsx";
    return reply
      .header("Content-Type", MIME_XLSX)
      .header("Content-Disposition", `attachment; filename="${nombre}"`)
      .send(archivo);
  }
};
