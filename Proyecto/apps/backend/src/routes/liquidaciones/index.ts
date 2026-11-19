import type { FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import {
  generarLiquidaciones,
  listarLiquidaciones,
  listarMisLiquidaciones,
  obtenerLiquidacion,
  pagarLiquidacion
} from "@cotizapp/application";
import { DrizzleLiquidacionRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

const deps = (request: FastifyRequest) => ({
  liquidacionRepository: new DrizzleLiquidacionRepository(request.server.db),
  usuarioRepository: new DrizzleUsuarioRepository(request.server.db)
});
const uid = (request: FastifyRequest) => Number(request.auth?.sub);
// Lectura: cualquier nivel (parcial o total). Escritura: total.
const lectura = [requireAuth, requirePermiso("liquidar_proveedor")];
const escritura = [requireAuth, requirePermiso({ codigo: "liquidar_proveedor", minimo: "total" })];

// ?proveedorId=&estado=&desde=&hasta=&pagina=&tamano= (KAN-152)
const listRoute: RouteOptions = {
  method: "GET",
  url: "/liquidaciones",
  preHandler: lectura,
  handler: async (request) => listarLiquidaciones(deps(request))(request.query)
};

// Proveedor autenticado: solo las de su organizacion. (Ruta estatica: tiene prioridad sobre /:id.)
const miasRoute: RouteOptions = {
  method: "GET",
  url: "/liquidaciones/mias",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request) => listarMisLiquidaciones(deps(request))(uid(request), request.query)
};

const getRoute: RouteOptions = {
  method: "GET",
  url: "/liquidaciones/:id",
  preHandler: lectura,
  handler: async (request) => obtenerLiquidacion(deps(request))(idParamSchema.parse(request.params).id)
};

// Body { desde?, hasta? } (YYYY-MM-DD, hora de Chile). Sin desde = semana anterior.
const generarRoute: RouteOptions = {
  method: "POST",
  url: "/liquidaciones/generar",
  preHandler: escritura,
  handler: async (request) => generarLiquidaciones(deps(request))(request.body, uid(request))
};

const pagarRoute: RouteOptions = {
  method: "POST",
  url: "/liquidaciones/:id/pagar",
  preHandler: escritura,
  handler: async (request) =>
    pagarLiquidacion(deps(request))(idParamSchema.parse(request.params).id, request.body, uid(request))
};

export const liquidacionRoutes: RouteOptions[] = [listRoute, miasRoute, getRoute, generarRoute, pagarRoute];
