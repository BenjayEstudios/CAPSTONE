import type { RouteOptions } from "fastify";
import { loginAdmin } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";

// Ruta publica: login del sitio administrativo (solo organizacion interna).
export const loginAdminRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/login",
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    // La validacion (Zod, en @cotizapp/domain) la hace el caso de uso.
    return loginAdmin({ usuarioRepository, firmarToken })(request.body as never);
  }
};
