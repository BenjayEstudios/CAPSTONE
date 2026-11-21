import type { FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { calificarEnvio, cambiarEstadoEnvio, listarOrdenes, obtenerOrden } from "@cotizapp/application";
import { DrizzleCalificacionRepository, DrizzleOrdenRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

const deps = (request: FastifyRequest) => ({
  ordenRepository: new DrizzleOrdenRepository(request.server.db),
  usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
});
const uid = (request: FastifyRequest) => Number(request.auth?.sub);
// El alcance (propias / del proveedor / todas) lo resuelve el caso de uso segun rol y organizacion.
const preHandler = [requireAuth, requirePermiso("ver_ordenes_propias", "ver_todas_ordenes")];

// ?estado=&pagina=&tamano= (KAN-149)
export const listOrdenesRoute: RouteOptions = {
  method: "GET",
  url: "/ordenes",
  preHandler,
  handler: async (request) => listarOrdenes(deps(request))(uid(request), request.query)
};

export const getOrdenRoute: RouteOptions = {
  method: "GET",
  url: "/ordenes/:id",
  preHandler,
  handler: async (request) => obtenerOrden(deps(request))(uid(request), idParamSchema.parse(request.params).id)
};

export const patchEstadoEnvioRoute: RouteOptions = {
  method: "PATCH",
  url: "/ordenes/envios/:id/estado",
  preHandler,
  handler: async (request) =>
    cambiarEstadoEnvio(deps(request))(uid(request), idParamSchema.parse(request.params).id, request.body)
};

// El comprador califica al proveedor de un envio entregado, una vez (KAN-99).
export const calificarEnvioRoute: RouteOptions = {
  method: "POST",
  url: "/ordenes/envios/:id/calificacion",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request, reply) => {
    const r = await calificarEnvio({
      calificacionRepository: new DrizzleCalificacionRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
    })(uid(request), idParamSchema.parse(request.params).id, request.body);
    return reply.status(201).send(r);
  }
};

export const ordenRoutes: RouteOptions[] = [listOrdenesRoute, getOrdenRoute, patchEstadoEnvioRoute, calificarEnvioRoute];
