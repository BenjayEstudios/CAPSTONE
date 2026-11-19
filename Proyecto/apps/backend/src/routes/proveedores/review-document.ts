import type { RouteOptions } from "fastify";
import { documentoParamSchema } from "@cotizapp/domain";
import { revisarDocumentoProveedor } from "@cotizapp/application";
import { DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

export const reviewDocumentoProveedorRoute: RouteOptions = {
  method: "PATCH",
  url: "/proveedores/:id/documentos/:documentoId/revision",
  preHandler: [requireAuth, requirePermiso("aprobar_proveedor")],
  handler: async (request) => {
    const { id, documentoId } = documentoParamSchema.parse(request.params);
    return revisarDocumentoProveedor({ proveedorRepository: new DrizzleProveedorRepository(request.server.db) })(
      id,
      documentoId,
      request.body,
      Number(request.auth?.sub)
    );
  }
};
