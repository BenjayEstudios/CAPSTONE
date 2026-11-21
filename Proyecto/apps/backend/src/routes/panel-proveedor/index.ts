import type { RouteOptions } from "fastify";
import { listarClientes, listarVentas, miCobertura } from "@cotizapp/application";
import { DrizzleOrdenRepository, DrizzleProveedorRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
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

// Ordenes de venta (KAN-105): los envios del proveedor de la sesion.
// ?estado=&pagina=&tamano=. El estado se avanza con PATCH /ordenes/envios/:id/estado.
export const misVentasRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/ventas",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) =>
    listarVentas({
      ordenRepository: new DrizzleOrdenRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
    })(Number(request.auth?.sub), request.query)
};

// Tus clientes (KAN-106): quien le compro al proveedor de la sesion. El
// contacto se entrega solo desde la primera orden pagada. ?pagina=&tamano=.
export const misClientesRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/clientes",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) =>
    listarClientes({
      ordenRepository: new DrizzleOrdenRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
    })(Number(request.auth?.sub), request.query)
};

export const panelProveedorRoutes: RouteOptions[] = [miCoberturaRoute, misVentasRoute, misClientesRoute];
