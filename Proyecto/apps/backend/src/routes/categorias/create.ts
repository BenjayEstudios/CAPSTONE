import type { RouteOptions } from "fastify";
import { crearCategoria } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Ruta protegida: requiere estar logueado y tener rol "administrador"
// (ver apps/backend/src/plugins/auth.ts). La validacion (Zod) y las reglas
// (slug unico, arbol de 2 niveles) viven en el caso de uso.
export const createCategoriaRoute: RouteOptions = {
  method: "POST",
  url: "/categorias",
  preHandler: [requireAuth, requirePermiso("crear_producto")],
  handler: async (request, reply) => {
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    const nuevaCategoria = await crearCategoria({ categoriaRepository })(request.body as never);
    reply.status(201);
    return nuevaCategoria;
  }
};
