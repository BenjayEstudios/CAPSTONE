import type { RouteOptions } from "fastify";
import { registrarComprador, registrarProveedor } from "@cotizapp/application";
import { DrizzleCuentaRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { firmarToken } from "../../lib/jwt.js";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";

// Compartido por ambas rutas: frena la creacion masiva de cuentas por IP.
const limitarRegistro = crearLimitadorTasa({ max: 10, ventanaMs: 15 * 60_000 });

// Publica. Crea la cuenta del comprador y devuelve la sesion (201).
export const registroCompradorRoute: RouteOptions = {
  method: "POST",
  url: "/auth/registro/comprador",
  preHandler: [limitarRegistro],
  handler: async (request, reply) => {
    const db = request.server.db;
    const r = await registrarComprador({
      cuentaRepository: new DrizzleCuentaRepository(db),
      usuarioRepository: new DrizzleUsuarioRepository(db),
      firmarToken
    })(request.body as never);
    return reply.status(201).send(r);
  }
};

// Publica. Crea la cuenta del proveedor en revision (201, sin sesion).
export const registroProveedorRoute: RouteOptions = {
  method: "POST",
  url: "/auth/registro/proveedor",
  preHandler: [limitarRegistro],
  handler: async (request, reply) => {
    const r = await registrarProveedor({ cuentaRepository: new DrizzleCuentaRepository(request.server.db) })(request.body as never);
    return reply.status(201).send(r);
  }
};
