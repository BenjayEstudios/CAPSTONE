import type { RouteOptions } from "fastify";
import { listarRoles } from "@cotizapp/application";
import { DrizzleRolRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const listRolesRoute: RouteOptions = {
  method: "GET",
  url: "/roles",
  preHandler: [requireAuth, requirePermiso({ codigo: "cambiar_permisos", minimo: "total" })],
  handler: async (request) => listarRoles({ rolRepository: new DrizzleRolRepository(request.server.db) })()
};
