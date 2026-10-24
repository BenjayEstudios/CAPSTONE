import type { RouteOptions } from "fastify";
import { listProductosRoute } from "./list.js";
import { getProductoRoute } from "./get.js";
import { createProductoRoute } from "./create.js";
import { updateProductoRoute } from "./update.js";
import { replaceImagenesProductoRoute } from "./replace-images.js";
import { uploadImagenProductoRoute } from "./upload-image.js";

export const productoRoutes: RouteOptions[] = [
  listProductosRoute,
  getProductoRoute,
  createProductoRoute,
  updateProductoRoute,
  replaceImagenesProductoRoute,
  uploadImagenProductoRoute
];
