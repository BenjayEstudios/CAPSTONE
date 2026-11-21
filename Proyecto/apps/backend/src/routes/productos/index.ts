import type { RouteOptions } from "fastify";
import { listProductosRoute } from "./list.js";
import { getProductoRoute } from "./get.js";
import { createProductoRoute } from "./create.js";
import { updateProductoRoute } from "./update.js";
import { replaceImagenesProductoRoute } from "./replace-images.js";
import { uploadImagenProductoRoute } from "./upload-image.js";
import { plantillaImportacionRoute } from "./plantilla-importacion.js";
import { importProductosRoute } from "./import.js";

export const productoRoutes: RouteOptions[] = [
  listProductosRoute,
  plantillaImportacionRoute,
  importProductosRoute,
  getProductoRoute,
  createProductoRoute,
  updateProductoRoute,
  replaceImagenesProductoRoute,
  uploadImagenProductoRoute
];
