import type { RouteOptions } from "fastify";
import { calificacionesRecibidas } from "@cotizapp/application";
import { DrizzleCalificacionRepository, DrizzleProveedorRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// KAN-200 (lo usa la app movil en KAN-135): calificaciones que recibio el
// proveedor de la sesion, con resumen, distribucion por puntaje y listado
// paginado. Un usuario que no es de una organizacion proveedor recibe 403.
export const calificacionesRecibidasRoute: RouteOptions = {
  method: "GET",
  url: "/calificaciones/recibidas",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) =>
    calificacionesRecibidas({
      calificacionRepository: new DrizzleCalificacionRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db),
      proveedorRepository: new DrizzleProveedorRepository(request.server.db)
    })(Number(request.auth?.sub), request.query)
};

export const calificacionRoutes: RouteOptions[] = [calificacionesRecibidasRoute];
