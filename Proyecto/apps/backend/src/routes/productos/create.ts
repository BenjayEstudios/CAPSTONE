import type { RouteOptions } from "fastify";
import { crearProducto } from "@cotizapp/application";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { requireAuth, requireRol } from "../../plugins/auth.js";

// Solo la administracion crea productos.
export const createProductoRoute: RouteOptions = {
  method: "POST",
  url: "/productos",
  preHandler: [requireAuth, requireRol("administrador")],
  handler: async (request, reply) => {
    const db = request.server.db;
    const producto = await crearProducto({
      productoRepository: new DrizzleProductoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(request.body, Number(request.auth?.sub));
    reply.status(201);
    return producto;
  }
};
