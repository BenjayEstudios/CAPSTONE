import type { RouteOptions } from "fastify";
import { listarCatalogo } from "@cotizapp/application";
import { DrizzleCatalogoRepository, DrizzleCategoriaRepository } from "@cotizapp/infrastructure";

// Publica: catalogo del comprador con busqueda y filtros (KAN-145).
// ?q&categoriaId&plazoMaxHoras&maxUnidadesPorCaja&orden&pagina&porPagina
export const listCatalogoRoute: RouteOptions = {
  method: "GET",
  url: "/catalogo/productos",
  handler: async (request) => {
    const db = request.server.db;
    return listarCatalogo({
      catalogoRepository: new DrizzleCatalogoRepository(db),
      categoriaRepository: new DrizzleCategoriaRepository(db)
    })(request.query);
  }
};
