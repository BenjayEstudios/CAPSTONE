import type { RouteOptions } from "fastify";
import { resumenCatalogo } from "@cotizapp/application";
import { DrizzleCatalogoRepository, DrizzleCategoriaRepository } from "@cotizapp/infrastructure";

// Publica: contadores y arbol de categorias con productos visibles, para el
// inicio del ecommerce (KAN-89).
export const resumenCatalogoRoute: RouteOptions = {
  method: "GET",
  url: "/catalogo/resumen",
  handler: async (request) => {
    const db = request.server.db;
    return resumenCatalogo({
      catalogoRepository: new DrizzleCatalogoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })();
  }
};
