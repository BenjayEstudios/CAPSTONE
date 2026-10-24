import type { RouteOptions } from "fastify";
import { loginAdmin } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";
import { crearDepsMfa } from "../../lib/mfa.js";

// Ruta publica: login del sitio administrativo (solo organizacion interna).
// Con mfa_estado=activo responde { mfaRequerido, desafio } (paso 1 del 2FA).
export const loginAdminRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/login",
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    const mfa = crearDepsMfa(request.server.servicioCorreo);
    // La validacion (Zod, en @cotizapp/domain) la hace el caso de uso.
    return loginAdmin({ usuarioRepository, firmarToken, mfa })(request.body as never);
  }
};
