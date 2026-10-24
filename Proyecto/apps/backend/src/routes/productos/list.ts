import type { RouteOptions } from "fastify";
import { listarProductos } from "@cotizapp/application";
import { DrizzleCategoriaRepository, DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { REQUISITOS_LECTURA_CATALOGO, requireAuth, requirePermiso } from "../../plugins/auth.js";

// Listado admin: ?estado=&categoriaId=&q=&pagina=&tamano=
export const listProductosRoute: RouteOptions = {
  method: "GET",
  url: "/productos",
  preHandler: [requireAuth, requirePermiso(...REQUISITOS_LECTURA_CATALOGO)],
  handler: async (request) => {
    const db = request.server.db;
    return listarProductos({
      productoRepository: new DrizzleProductoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(request.query);
  }
};
