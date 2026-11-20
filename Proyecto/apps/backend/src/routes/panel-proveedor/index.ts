import type { RouteOptions } from "fastify";
import { miCobertura } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Datos propios del proveedor de la sesion para su panel (KAN-102). La
// organizacion sale del token: nunca se pide por id.
export const miCoberturaRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/cobertura",
  preHandler: [requireAuth, requirePermiso("publicar_precio_stock")],
  handler: async (request) =>
    miCobertura({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(Number(request.auth?.organizacionId))
};

export const panelProveedorRoutes: RouteOptions[] = [miCoberturaRoute];
