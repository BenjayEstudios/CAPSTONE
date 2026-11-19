import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { rechazarProveedor } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const rechazarProveedorRoute: RouteOptions = {
  method: "POST",
  url: "/proveedores/:id/rechazar",
  preHandler: [requireAuth, requirePermiso("aprobar_proveedor")],
  handler: async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return rechazarProveedor({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(
      id,
      request.body,
      Number(request.auth?.sub)
    );
  }
};
