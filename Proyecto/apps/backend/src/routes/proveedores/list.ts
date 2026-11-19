import type { RouteOptions } from "fastify";
import { listarProveedores } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// ?estado=en_revision|activa|suspendida&q=&pagina=&tamano=
export const listProveedoresRoute: RouteOptions = {
  method: "GET",
  url: "/proveedores",
  preHandler: [requireAuth, requirePermiso("aprobar_proveedor")],
  handler: async (request) =>
    listarProveedores({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(request.query)
};
