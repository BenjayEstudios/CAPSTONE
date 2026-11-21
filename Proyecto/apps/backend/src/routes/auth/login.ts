import type { RouteOptions } from "fastify";
import { login } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";
import { crearDepsMfa } from "../../lib/mfa.js";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";

// Frena fuerza bruta de claves por IP (el control fino de 2FA vive en el caso de uso).
const limitarLogin = crearLimitadorTasa({ max: 20, ventanaMs: 5 * 60_000 });

// Ruta publica: login unico (ecommerce, mobile, admin-site). Ver
// apps/mobile/API_CONTRACT.md -> POST /auth/login.
export const loginRoute: RouteOptions = {
  method: "POST",
  url: "/auth/login",
  preHandler: [limitarLogin],
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    const mfa = crearDepsMfa();
    return login({ usuarioRepository, firmarToken, mfa })(request.body as never);
  }
};
