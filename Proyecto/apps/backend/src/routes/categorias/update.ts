import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { actualizarCategoria } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Edita nombre, slug, orden, estado (activa/oculta) y padreId. Solo administrador.
export const updateCategoriaRoute: RouteOptions = {
  method: "PATCH",
  url: "/categorias/:id",
  preHandler: [requireAuth, requirePermiso("crear_producto")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    return actualizarCategoria({ categoriaRepository })(id, request.body);
  }
};
