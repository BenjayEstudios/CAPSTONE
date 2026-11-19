import type { FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { buscarReembolsosPorCodigo, crearReembolso, listarReembolsosOrden } from "@cotizapp/application";
import { DrizzleDocumentoTributarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// KAN-120. Punto de extension para devolver el dinero por pasarela (KAN-148): pasar `devolverDinero` aqui.
const deps = (request: FastifyRequest) => ({
  documentoRepository: new DrizzleDocumentoTributarioRepository(request.server.db),
  emisorRut: process.env.SII_EMISOR_RUT || undefined
});
const uid = (request: FastifyRequest) => Number(request.auth?.sub);
const lectura = [requireAuth, requirePermiso("emitir_reembolso")];
const escritura = [requireAuth, requirePermiso({ codigo: "emitir_reembolso", minimo: "total" })];

export const buscarReembolsoRoute: RouteOptions = {
  method: "GET",
  url: "/reembolsos/buscar",
  preHandler: lectura,
  handler: async (request) => buscarReembolsosPorCodigo(deps(request))(request.query)
};

export const listReembolsosRoute: RouteOptions = {
  method: "GET",
  url: "/ordenes/:id/reembolsos",
  preHandler: lectura,
  handler: async (request) => listarReembolsosOrden(deps(request))(idParamSchema.parse(request.params).id)
};

export const createReembolsoRoute: RouteOptions = {
  method: "POST",
  url: "/ordenes/:id/reembolsos",
  preHandler: escritura,
  handler: async (request, reply) =>
    reply.status(201).send(await crearReembolso(deps(request))(uid(request), idParamSchema.parse(request.params).id, request.body))
};

export const reembolsoRoutes: RouteOptions[] = [buscarReembolsoRoute, listReembolsosRoute, createReembolsoRoute];
