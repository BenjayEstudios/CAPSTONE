import type { RouteOptions } from "fastify";
import {
  asignarCasoModeracion,
  descartarCasoModeracion,
  listarCasosModeracion,
  listarUsuariosInternosModeracion,
  obtenerCasoModeracion,
  resolverCasoModeracion
} from "@cotizapp/application";
import { DrizzleModeracionRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Mismo permiso que el modulo Moderacion del menu del admin.
const preHandler = [requireAuth, requirePermiso("aprobar_proveedor")];
const deps = (request: { server: { db: ConstructorParameters<typeof DrizzleModeracionRepository>[0] } }) => ({
  moderacionRepository: new DrizzleModeracionRepository(request.server.db)
});
const yo = (request: { auth?: { sub: string } }) => Number(request.auth?.sub);

// ?tipo=&estado=&asignadoA=<id>|sin_asignar&pagina=&tamano=
const listRoute: RouteOptions = {
  method: "GET",
  url: "/moderacion/casos",
  preHandler,
  handler: async (request) => listarCasosModeracion(deps(request))(request.query)
};

// Select "Asignar a...": usuarios internos activos (solo lectura).
const internosRoute: RouteOptions = {
  method: "GET",
  url: "/moderacion/usuarios-internos",
  preHandler,
  handler: async (request) => listarUsuariosInternosModeracion(deps(request))()
};

const getRoute: RouteOptions = {
  method: "GET",
  url: "/moderacion/casos/:id",
  preHandler,
  handler: async (request) => obtenerCasoModeracion(deps(request))(request.params)
};

const asignarRoute: RouteOptions = {
  method: "POST",
  url: "/moderacion/casos/:id/asignar",
  preHandler,
  handler: async (request) => asignarCasoModeracion(deps(request))(request.params, request.body, yo(request))
};

const resolverRoute: RouteOptions = {
  method: "POST",
  url: "/moderacion/casos/:id/resolver",
  preHandler,
  handler: async (request) => resolverCasoModeracion(deps(request))(request.params, request.body, yo(request))
};

const descartarRoute: RouteOptions = {
  method: "POST",
  url: "/moderacion/casos/:id/descartar",
  preHandler,
  handler: async (request) => descartarCasoModeracion(deps(request))(request.params, request.body, yo(request))
};

export const moderacionRoutes: RouteOptions[] = [listRoute, internosRoute, getRoute, asignarRoute, resolverRoute, descartarRoute];
