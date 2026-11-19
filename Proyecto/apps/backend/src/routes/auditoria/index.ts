import type { RouteOptions } from "fastify";
import { listarAuditoria, obtenerFiltrosAuditoria, obtenerRegistroAuditoria } from "@cotizapp/application";
import { DrizzleAuditoriaRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Modulo de SOLO LECTURA: no hay endpoints de escritura ni borrado.
const preHandler = [requireAuth, requirePermiso("ver_auditoria")];
const deps = (request: { server: { db: ConstructorParameters<typeof DrizzleAuditoriaRepository>[0] } }) => ({
  auditoriaRepository: new DrizzleAuditoriaRepository(request.server.db)
});

// ?entidad=&accion=&usuarioId=&desde=yyyy-mm-dd&hasta=yyyy-mm-dd&pagina=&tamano=
const listAuditoriaRoute: RouteOptions = {
  method: "GET",
  url: "/auditoria",
  preHandler,
  handler: async (request) => listarAuditoria(deps(request))(request.query)
};

const filtrosAuditoriaRoute: RouteOptions = {
  method: "GET",
  url: "/auditoria/filtros",
  preHandler,
  handler: async (request) => obtenerFiltrosAuditoria(deps(request))()
};

const getAuditoriaRoute: RouteOptions = {
  method: "GET",
  url: "/auditoria/:id",
  preHandler,
  handler: async (request) => obtenerRegistroAuditoria(deps(request))(request.params)
};

export const auditoriaRoutes: RouteOptions[] = [listAuditoriaRoute, filtrosAuditoriaRoute, getAuditoriaRoute];
