import type { RouteOptions } from "fastify";
import { reenviarMfaAdmin, verificarMfaAdmin } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";
import { crearDepsMfa } from "../../lib/mfa.js";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";

// Ademas del control por usuario (en el caso de uso), limite por IP.
const limitarVerificar = crearLimitadorTasa({ max: 30, ventanaMs: 5 * 60_000 });
const limitarReenviar = crearLimitadorTasa({ max: 10, ventanaMs: 5 * 60_000 });

// Paso 2 del 2FA: desafio + codigo de 6 digitos -> sesion.
export const mfaAdminRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/mfa",
  preHandler: [limitarVerificar],
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    const mfa = crearDepsMfa(request.server.servicioCorreo);
    return verificarMfaAdmin({ usuarioRepository, mfa, firmarToken })(request.body as never);
  }
};

export const mfaReenviarRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/mfa/reenviar",
  preHandler: [limitarReenviar],
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    const mfa = crearDepsMfa(request.server.servicioCorreo);
    return reenviarMfaAdmin({ usuarioRepository, mfa })(request.body as never);
  }
};
