import type { FastifyInstance, RouteOptions } from "fastify";
import { healthCheckRoute } from "./health-check/index.js";
import { categoriaRoutes } from "./categorias/index.js";

// Cada módulo de negocio (auth, catalogo, pedidos, pagos) expone su propio
// arreglo de RouteOptions (ej. src/routes/catalogo/index.ts) y se agrega
// acá. Las rutas llaman directamente a los casos de uso de
// @cotizapp/application, ya conectados en el composition root (app.ts).
// "categorias" es el ejemplo de referencia — el resto de módulos se agrega
// siguiendo el mismo patrón.
const routes: RouteOptions[] = [healthCheckRoute, ...categoriaRoutes];

export async function registerRoutes(app: FastifyInstance) {
  routes.forEach((route) => app.route(route));
}
