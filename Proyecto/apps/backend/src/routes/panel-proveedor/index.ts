import type { FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import {
  actualizarMiPerfilProveedor,
  actualizarPuntoRetiro,
  actualizarZona,
  crearPuntoRetiro,
  crearZona,
  eliminarPuntoRetiro,
  eliminarZona,
  misPuntosRetiro,
  regionesParaCobertura,
  demandaProveedor,
  listarClientes,
  listarVentas,
  miCobertura,
  miPerfilProveedor
} from "@cotizapp/application";
import {
  DrizzleAnaliticaRepository,
  DrizzleComunaRepository,
  DrizzleOrdenRepository,
  DrizzleProveedorRepository,
  DrizzleUsuarioRepository
} from "@cotizapp/infrastructure";
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

// Demanda y cobertura (KAN-107): ?desde&hasta (por defecto los ultimos 30
// dias). Mismo permiso que /proveedor/cobertura: solo cuentas de proveedor.
export const demandaRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/demanda",
  preHandler: [requireAuth, requirePermiso("publicar_precio_stock")],
  handler: async (request) =>
    demandaProveedor({ analiticaRepository: new DrizzleAnaliticaRepository(request.server.db) })(request.query, Number(request.auth?.organizacionId))
};

// Perfil de empresa (KAN-108). La organizacion sale del token.
const depsPerfil = (request: FastifyRequest) => ({
  proveedorRepository: new DrizzleProveedorRepository(request.server.db),
  comunaRepository: new DrizzleComunaRepository(request.server.db)
});
export const miPerfilRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/perfil",
  preHandler: [requireAuth, requirePermiso("publicar_precio_stock")],
  handler: async (request) => miPerfilProveedor(depsPerfil(request))(Number(request.auth?.organizacionId))
};
export const actualizarPerfilRoute: RouteOptions = {
  method: "PATCH",
  url: "/proveedor/perfil",
  preHandler: [requireAuth, requirePermiso("publicar_precio_stock")],
  handler: async (request) =>
    actualizarMiPerfilProveedor(depsPerfil(request))(Number(request.auth?.sub), Number(request.auth?.organizacionId), request.body)
};

// Cobertura de despacho y puntos de retiro (KAN-109). La organizacion sale
// del token; una fila de otro proveedor responde 404.
const proveedorDe = (request: FastifyRequest) => Number(request.auth?.organizacionId);
const usuarioDe = (request: FastifyRequest) => Number(request.auth?.sub);
const idDe = (request: FastifyRequest) => idParamSchema.parse(request.params).id;
const soloProveedor = [requireAuth, requirePermiso("publicar_precio_stock")];

export const regionesCoberturaRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/cobertura/regiones",
  preHandler: soloProveedor,
  handler: async (request) => regionesParaCobertura(depsPerfil(request))()
};
export const crearZonaRoute: RouteOptions = {
  method: "POST",
  url: "/proveedor/cobertura/zonas",
  preHandler: soloProveedor,
  handler: async (request, reply) => reply.status(201).send(await crearZona(depsPerfil(request))(usuarioDe(request), proveedorDe(request), request.body))
};
export const actualizarZonaRoute: RouteOptions = {
  method: "PATCH",
  url: "/proveedor/cobertura/zonas/:id",
  preHandler: soloProveedor,
  handler: async (request) => actualizarZona(depsPerfil(request))(usuarioDe(request), proveedorDe(request), idDe(request), request.body)
};
export const eliminarZonaRoute: RouteOptions = {
  method: "DELETE",
  url: "/proveedor/cobertura/zonas/:id",
  preHandler: soloProveedor,
  handler: async (request, reply) => {
    await eliminarZona(depsPerfil(request))(usuarioDe(request), proveedorDe(request), idDe(request));
    return reply.status(204).send();
  }
};
export const misPuntosRetiroRoute: RouteOptions = {
  method: "GET",
  url: "/proveedor/puntos-retiro",
  preHandler: soloProveedor,
  handler: async (request) => misPuntosRetiro(depsPerfil(request))(proveedorDe(request))
};
export const crearPuntoRetiroRoute: RouteOptions = {
  method: "POST",
  url: "/proveedor/puntos-retiro",
  preHandler: soloProveedor,
  handler: async (request, reply) => reply.status(201).send(await crearPuntoRetiro(depsPerfil(request))(usuarioDe(request), proveedorDe(request), request.body))
};
export const actualizarPuntoRetiroRoute: RouteOptions = {
  method: "PATCH",
  url: "/proveedor/puntos-retiro/:id",
  preHandler: soloProveedor,
  handler: async (request) => actualizarPuntoRetiro(depsPerfil(request))(usuarioDe(request), proveedorDe(request), idDe(request), request.body)
};
export const eliminarPuntoRetiroRoute: RouteOptions = {
  method: "DELETE",
  url: "/proveedor/puntos-retiro/:id",
  preHandler: soloProveedor,
  handler: async (request, reply) => {
    await eliminarPuntoRetiro(depsPerfil(request))(usuarioDe(request), proveedorDe(request), idDe(request));
    return reply.status(204).send();
  }
};

export const panelProveedorRoutes: RouteOptions[] = [
  miCoberturaRoute,
  misVentasRoute,
  misClientesRoute,
  demandaRoute,
  miPerfilRoute,
  actualizarPerfilRoute,
  regionesCoberturaRoute,
  crearZonaRoute,
  actualizarZonaRoute,
  eliminarZonaRoute,
  misPuntosRetiroRoute,
  crearPuntoRetiroRoute,
  actualizarPuntoRetiroRoute,
  eliminarPuntoRetiroRoute
];
