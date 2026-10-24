import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { aprobarProveedor } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const aprobarProveedorRoute: RouteOptions = {
  method: "POST",
  url: "/proveedores/:id/aprobar",
  preHandler: [requireAuth, requirePermiso("aprobar_proveedor")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return aprobarProveedor({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(
      id,
      request.body,
      Number(request.auth?.sub)
    );
  }
};
