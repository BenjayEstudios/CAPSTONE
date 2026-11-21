import type { RouteOptions } from "fastify";
import { getCatalogoRoute } from "./get.js";
import { listCatalogoRoute } from "./list.js";
import { resumenCatalogoRoute } from "./resumen.js";

// Catalogo publico del comprador (KAN-145). El listado de administracion
// sigue en /productos.
export const catalogoRoutes: RouteOptions[] = [listCatalogoRoute, resumenCatalogoRoute, getCatalogoRoute];
