import type { RouteOptions } from "fastify";
import { listCategoriasRoute } from "./list.js";
import { createCategoriaRoute } from "./create.js";

export const categoriaRoutes: RouteOptions[] = [listCategoriasRoute, createCategoriaRoute];
