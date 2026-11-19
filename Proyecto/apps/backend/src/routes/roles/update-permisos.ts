import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { actualizarPermisosRol } from "@cotizapp/application";
import { DrizzleRolRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const updatePermisosRolRoute: RouteOptions = {
  method: "PUT",
  url: "/roles/:id/permisos",
  preHandler: [requireAuth, requirePermiso({ codigo: "cambiar_permisos", minimo: "total" })],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const db = request.server.db;
    return actualizarPermisosRol({ rolRepository: new DrizzleRolRepository(db), usuarioRepository: new DrizzleUsuarioRepository(db) })(
      id,
      request.body,
      Number(request.auth?.sub)
    );
  }
};
