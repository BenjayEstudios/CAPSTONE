import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { obtenerProveedor } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const getProveedorRoute: RouteOptions = {
  method: "GET",
  url: "/proveedores/:id",
  preHandler: [requireAuth, requirePermiso("aprobar_proveedor")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return obtenerProveedor({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(id);
  }
};
