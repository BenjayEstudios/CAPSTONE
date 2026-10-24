import type { FastifyRequest, RouteOptions } from "fastify";
import { estadisticasPlataforma, estadisticasProveedor } from "@cotizapp/application";
import { DrizzleEventoAnaliticoRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Solo lectura. Nunca devuelven sesion_id ni usuario_id.
const deps = (request: FastifyRequest) => ({ eventoRepository: new DrizzleEventoAnaliticoRepository(request.server.db) });

// ?desde=yyyy-mm-dd&hasta=yyyy-mm-dd (max 366 dias; por defecto ultimos 30)
const plataformaRoute: RouteOptions = {
  method: "GET",
  url: "/estadisticas/plataforma",
  preHandler: [requireAuth, requirePermiso("ver_todas_ordenes")],
  handler: async (request) => estadisticasPlataforma(deps(request))(request.query)
};

const proveedorRoute: RouteOptions = {
  method: "GET",
  url: "/estadisticas/proveedor",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) => estadisticasProveedor(deps(request))(request.query, Number(request.auth?.organizacionId))
};

export const estadisticasRoutes: RouteOptions[] = [plataformaRoute, proveedorRoute];
