import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { obtenerFichaCatalogo } from "@cotizapp/application";
import { DrizzleCalificacionRepository, DrizzleCatalogoRepository } from "@cotizapp/infrastructure";
import { leerAuthOpcional } from "../../plugins/auth.js";

// Publica: ficha con el comparador de ofertas (KAN-145). Si hay sesion de
// comprador, la tarifa de despacho es la de su comuna; si no, la de la RM.
export const getCatalogoRoute: RouteOptions = {
  method: "GET",
  url: "/catalogo/productos/:id",
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const db = request.server.db;
    return obtenerFichaCatalogo({
      catalogoRepository: new DrizzleCatalogoRepository(db),
      calificacionRepository: new DrizzleCalificacionRepository(db)
    })(id, request.query, leerAuthOpcional(request)?.organizacionId);
  }
};
