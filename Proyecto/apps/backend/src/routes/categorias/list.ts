import type { FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import { listarCategoriasQuerySchema } from "@cotizapp/domain";
import { listarCategorias } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requireRol } from "../../plugins/auth.js";

// Solo el administrador puede pedir ?incluirOcultas=true; sin ese parametro
// la ruta sigue siendo publica (el catalogo se ve sin login).
async function exigirAdminSiIncluyeOcultas(request: FastifyRequest, reply: FastifyReply) {
  const { incluirOcultas } = listarCategoriasQuerySchema.parse(request.query);
  if (!incluirOcultas) return;
  await requireAuth(request, reply);
  if (reply.sent) return;
  await requireRol("administrador")(request, reply);
}

export const listCategoriasRoute: RouteOptions = {
  method: "GET",
  url: "/categorias",
  preHandler: [exigirAdminSiIncluyeOcultas],
  handler: async (request) => {
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    const query = listarCategoriasQuerySchema.parse(request.query);
    return listarCategorias({ categoriaRepository })(query);
  }
};
