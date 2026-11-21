import type { RouteOptions } from "fastify";
import { restablecerClave, solicitarRecuperacionClave } from "@cotizapp/application";
import { DrizzleCuentaRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { logger } from "../../lib/logger.js";
import { crearDepsRecuperacion } from "../../lib/recuperacion.js";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";

const limitarSolicitud = crearLimitadorTasa({ max: 5, ventanaMs: 15 * 60_000 });
const limitarRestablecer = crearLimitadorTasa({ max: 20, ventanaMs: 15 * 60_000 });

const deps = (request: Parameters<NonNullable<RouteOptions["handler"]>>[0]) =>
  crearDepsRecuperacion({ ecommerce: request.server.ecommerceUrl, adminSite: request.server.adminSiteUrl });

// Publica. Responde 202 { ok: true } exista o no el correo.
export const solicitarRecuperacionRoute: RouteOptions = {
  method: "POST",
  url: "/auth/recuperar",
  preHandler: [limitarSolicitud],
  handler: async (request, reply) => {
    const r = await solicitarRecuperacionClave({
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db),
      servicioCorreo: request.server.servicioCorreo,
      recuperacion: deps(request),
      alFallarCorreo: (e) => logger.error("No se pudo enviar el correo de recuperacion", { err: e })
    })(request.body as never);
    return reply.status(202).send(r);
  }
};

// Publica. Token del enlace + clave nueva.
export const restablecerClaveRoute: RouteOptions = {
  method: "POST",
  url: "/auth/restablecer",
  preHandler: [limitarRestablecer],
  handler: async (request) => {
    const db = request.server.db;
    return restablecerClave({
      usuarioRepository: new DrizzleUsuarioRepository(db),
      cuentaRepository: new DrizzleCuentaRepository(db),
      recuperacion: deps(request)
    })(request.body as never);
  }
};
