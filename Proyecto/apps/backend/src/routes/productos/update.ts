import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { actualizarProducto } from "@cotizapp/application";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const updateProductoRoute: RouteOptions = {
  method: "PATCH",
  url: "/productos/:id",
  preHandler: [requireAuth, requirePermiso("crear_producto")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const db = request.server.db;
    return actualizarProducto({
      productoRepository: new DrizzleProductoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(id, request.body);
  }
};
