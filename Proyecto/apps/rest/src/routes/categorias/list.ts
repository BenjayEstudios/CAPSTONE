import type { RouteOptions } from "fastify";
import { listarCategorias } from "@cotizapp/application";
import { DrizzleCategoriaRepository } from "@cotizapp/infrastructure";

// Ruta publica: el catalogo de categorias se ve sin login.
export const listCategoriasRoute: RouteOptions = {
  method: "GET",
  url: "/categorias",
  handler: async (request) => {
    const categoriaRepository = new DrizzleCategoriaRepository(request.server.db);
    return listarCategorias({ categoriaRepository })();
  }
};
