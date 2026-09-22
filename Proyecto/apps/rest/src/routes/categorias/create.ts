import type { RouteOptions } from "fastify";
import { crearCategoriaSchema } from "@cotizapp/domain";
import { crearCategoria } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requireRol } from "../../plugins/auth.js";

// Ruta protegida: requiere estar logueado y tener rol "administrador"
// (ver apps/rest/src/plugins/auth.ts).
export const createCategoriaRoute: RouteOptions = {
  method: "POST",
  url: "/categorias",
  preHandler: [requireAuth, requireRol("administrador")],
  handler: async (request, reply) => {
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    const input = crearCategoriaSchema.parse(request.body);
    const nuevaCategoria = await crearCategoria({ categoriaRepository })(input);
    reply.status(201);
    return nuevaCategoria;
  }
};
