import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { reemplazarImagenesProducto } from "@cotizapp/application";
import { DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { requireAuth, requireRol } from "../../plugins/auth.js";

// Reemplaza los metadatos de imagenes. NO sube archivos (storage pendiente).
export const replaceImagenesProductoRoute: RouteOptions = {
  method: "PUT",
  url: "/productos/:id/imagenes",
  preHandler: [requireAuth, requireRol("administrador")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const productoRepository = new DrizzleProductoRepository(request.server.db);
    return reemplazarImagenesProducto({ productoRepository })(id, request.body, Number(request.auth?.sub));
  }
};
