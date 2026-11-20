import type { RouteOptions } from "fastify";
import { getCatalogoRoute } from "./get.js";
import { listCatalogoRoute } from "./list.js";

// Catalogo publico del comprador (KAN-145). El listado de administracion
// sigue en /productos.
export const catalogoRoutes: RouteOptions[] = [listCatalogoRoute, getCatalogoRoute];
