import type { RouteOptions } from "fastify";
import { alertasProveedor } from "@cotizapp/application";
import { DrizzleAnaliticaRepository, DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Lo que requiere atencion en el panel del proveedor (KAN-101) y en la app
// movil (KAN-137): documentos, stock bajo, por cobrar y envios por despachar.
export const alertasProveedorRoute: RouteOptions = {
  method: "GET",
  url: "/alertas/proveedor",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) =>
    alertasProveedor({
      analiticaRepository: new DrizzleAnaliticaRepository(request.server.db),
      proveedorRepository: new DrizzleProveedorRepository(request.server.db)
    })(Number(request.auth?.organizacionId))
};

export const alertaRoutes: RouteOptions[] = [alertasProveedorRoute];
