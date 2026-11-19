import type { RouteOptions } from "fastify";
import { resumenDashboard } from "@cotizapp/application";
import { DrizzleDashboardRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Solo lectura. GET /dashboard/resumen?mes=YYYY-MM (por defecto, mes actual en America/Santiago).
const resumenRoute: RouteOptions = {
  method: "GET",
  url: "/dashboard/resumen",
  preHandler: [requireAuth, requirePermiso("ver_todas_ordenes")],
  handler: async (request) => resumenDashboard({ dashboardRepository: new DrizzleDashboardRepository(request.server.db) })(request.query)
};

export const dashboardRoutes: RouteOptions[] = [resumenRoute];
