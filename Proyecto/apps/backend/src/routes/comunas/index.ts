import type { RouteOptions } from "fastify";
import { listarComunas } from "@cotizapp/application";
import { DrizzleComunaRepository } from "@cotizapp/infrastructure";

// GET /comunas (KAN-95): publica, para escribir una direccion nueva en el checkout.
export const listComunasRoute: RouteOptions = {
  method: "GET",
  url: "/comunas",
  handler: async (request) => listarComunas({ comunaRepository: new DrizzleComunaRepository(request.server.db) })()
};

export const comunaRoutes: RouteOptions[] = [listComunasRoute];
