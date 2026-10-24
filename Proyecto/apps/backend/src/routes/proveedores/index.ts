import type { RouteOptions } from "fastify";
import { listProveedoresRoute } from "./list.js";
import { getProveedorRoute } from "./get.js";
import { reviewDocumentoProveedorRoute } from "./review-document.js";
import { aprobarProveedorRoute } from "./approve.js";
import { rechazarProveedorRoute } from "./reject.js";
import { suspenderProveedorRoute } from "./suspend.js";

export const proveedorRoutes: RouteOptions[] = [
  listProveedoresRoute,
  getProveedorRoute,
  reviewDocumentoProveedorRoute,
  aprobarProveedorRoute,
  rechazarProveedorRoute,
  suspenderProveedorRoute
];
