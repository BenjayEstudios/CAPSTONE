import type { RouteOptions } from "fastify";
import { obtenerSesionUsuario } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth } from "../../plugins/auth.js";

// Devuelve el usuario actual leido de la DB (permisos frescos).
export const meRoute: RouteOptions = {
  method: "GET",
  url: "/auth/me",
  preHandler: [requireAuth],
  handler: async (request) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    return obtenerSesionUsuario({ usuarioRepository })(Number(request.auth?.sub));
  }
};
