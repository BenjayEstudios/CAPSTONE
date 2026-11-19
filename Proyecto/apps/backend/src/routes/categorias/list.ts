import type { FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import { listarCategoriasQuerySchema } from "@cotizapp/domain";
import { listarCategorias } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";
import { REQUISITOS_LECTURA_CATALOGO, requireAuth, requirePermiso } from "../../plugins/auth.js";

// Solo quien gestiona el catalogo (ver REQUISITOS_LECTURA_CATALOGO) puede pedir ?incluirOcultas=true; sin ese parametro
// la ruta sigue siendo publica (el catalogo se ve sin login).
async function exigirPermisoSiIncluyeOcultas(request: FastifyRequest, reply: FastifyReply) {
  const { incluirOcultas } = listarCategoriasQuerySchema.parse(request.query);
  if (!incluirOcultas) return;
  await requireAuth(request, reply);
  if (reply.sent) return;
  // Si falla, lanza ErrorAplicacion y lo serializa lib/error-handler.ts.
  await requirePermiso(...REQUISITOS_LECTURA_CATALOGO)(request);
}

export const listCategoriasRoute: RouteOptions = {
  method: "GET",
  url: "/categorias",
  preHandler: [exigirPermisoSiIncluyeOcultas],
  handler: async (request) => {
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    const query = listarCategoriasQuerySchema.parse(request.query);
    return listarCategorias({ categoriaRepository })(query);
  }
};
