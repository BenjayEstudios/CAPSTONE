import type { FastifyRequest, RouteOptions } from "fastify";
import { confirmarCarro, obtenerCarro, reemplazarCarro } from "@cotizapp/application";
import { DrizzleCarroRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

const deps = (request: FastifyRequest) => ({
  carroRepository: new DrizzleCarroRepository(request.server.db),
  usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
});
const uid = (request: FastifyRequest) => Number(request.auth?.sub);
const preHandler = [requireAuth, requirePermiso("ver_ordenes_propias")];

// Carro persistente del usuario cliente (KAN-147).
export const getCarroRoute: RouteOptions = {
  method: "GET",
  url: "/carro",
  preHandler,
  handler: async (request) => obtenerCarro(deps(request))(uid(request))
};

export const putCarroRoute: RouteOptions = {
  method: "PUT",
  url: "/carro",
  preHandler,
  handler: async (request) => reemplazarCarro(deps(request))(uid(request), request.body)
};

export const confirmarCarroRoute: RouteOptions = {
  method: "POST",
  url: "/carro/confirmar",
  preHandler,
  handler: async (request, reply) => {
    const r = await confirmarCarro(deps(request))(uid(request), request.body);
    return reply.status(201).send(r);
  }
};

export const carroRoutes: RouteOptions[] = [getCarroRoute, putCarroRoute, confirmarCarroRoute];
