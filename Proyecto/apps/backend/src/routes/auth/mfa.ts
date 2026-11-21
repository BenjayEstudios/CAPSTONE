import type { RouteOptions } from "fastify";
import { confirmarEnrolamientoMfa, iniciarEnrolamientoMfa, verificarMfaAdmin } from "@cotizapp/application";
import { DrizzleCuentaRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";
import { crearDepsMfa } from "../../lib/mfa.js";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";

// Ademas del control por usuario (en el caso de uso), limite por IP.
const limitarVerificar = crearLimitadorTasa({ max: 30, ventanaMs: 5 * 60_000 });
const limitarEnrolar = crearLimitadorTasa({ max: 20, ventanaMs: 10 * 60_000 });

// Paso 2 del 2FA (usuario enrolado): desafio + codigo de la app -> sesion.
export const mfaAdminRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/mfa",
  preHandler: [limitarVerificar],
  handler: async (request) =>
    verificarMfaAdmin({ usuarioRepository: new DrizzleUsuarioRepository(request.server.db), mfa: crearDepsMfa(), firmarToken })(
      request.body as never
    )
};

// Enrolamiento, paso a: desafio de enrolamiento -> secreto + QR + desafio de confirmacion.
export const mfaEnrolarRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/mfa/enrolar",
  preHandler: [limitarEnrolar],
  handler: async (request) => {
    const db = request.server.db;
    return iniciarEnrolamientoMfa({
      usuarioRepository: new DrizzleUsuarioRepository(db),
      cuentaRepository: new DrizzleCuentaRepository(db),
      mfa: crearDepsMfa()
    })(request.body as never);
  }
};

// Enrolamiento, paso b: desafio de confirmacion + primer codigo -> activa el 2FA y entrega la sesion.
export const mfaConfirmarRoute: RouteOptions = {
  method: "POST",
  url: "/auth/admin/mfa/confirmar",
  preHandler: [limitarVerificar],
  handler: async (request) => {
    const db = request.server.db;
    return confirmarEnrolamientoMfa({
      usuarioRepository: new DrizzleUsuarioRepository(db),
      cuentaRepository: new DrizzleCuentaRepository(db),
      mfa: crearDepsMfa(),
      firmarToken
    })(request.body as never);
  }
};
