import type { RouteOptions } from "fastify";
import { listCategoriasRoute } from "./list.js";
import { createCategoriaRoute } from "./create.js";
import { updateCategoriaRoute } from "./update.js";

export const categoriaRoutes: RouteOptions[] = [listCategoriasRoute, createCategoriaRoute, updateCategoriaRoute];
