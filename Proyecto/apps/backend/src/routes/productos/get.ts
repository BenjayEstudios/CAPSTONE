import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { obtenerProducto } from "@cotizapp/application";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { REQUISITOS_LECTURA_CATALOGO, requireAuth, requirePermiso } from "../../plugins/auth.js";

export const getProductoRoute: RouteOptions = {
  method: "GET",
  url: "/productos/:id",
  preHandler: [requireAuth, requirePermiso(...REQUISITOS_LECTURA_CATALOGO)],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const db = request.server.db;
    return obtenerProducto({
      productoRepository: new DrizzleProductoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(id);
  }
};
