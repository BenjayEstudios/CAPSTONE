import type { FastifyInstance, RouteOptions } from "fastify";
import { healthCheckRoute } from "./health-check/index.js";
import { categoriaRoutes } from "./categorias/index.js";
import { authRoutes } from "./auth/index.js";
import { productoRoutes } from "./productos/index.js";
import { proveedorRoutes } from "./proveedores/index.js";
import { auditoriaRoutes } from "./auditoria/index.js";
import { rolRoutes } from "./roles/index.js";
import { usuarioRoutes } from "./usuarios/index.js";
import { moderacionRoutes } from "./moderacion/index.js";
import { carroRoutes } from "./carro/index.js";
import { ordenRoutes } from "./ordenes/index.js";
import { documentoTributarioRoutes } from "./documentos-tributarios/index.js";
import { reembolsoRoutes } from "./reembolsos/index.js";
import { eventoRoutes } from "./eventos/index.js";
import { estadisticasRoutes } from "./estadisticas/index.js";
import { liquidacionRoutes } from "./liquidaciones/index.js";
import { dashboardRoutes } from "./dashboard/index.js";

// Cada módulo de negocio (auth, catalogo, pedidos, pagos) expone su propio
// arreglo de RouteOptions (ej. src/routes/catalogo/index.ts) y se agrega
// acá. Las rutas llaman directamente a los casos de uso de
// @cotizapp/application, ya conectados en el composition root (app.ts).
// "categorias" es el ejemplo de referencia — el resto de módulos se agrega
// siguiendo el mismo patrón.
const routes: RouteOptions[] = [healthCheckRoute, ...categoriaRoutes, ...authRoutes, ...productoRoutes, ...proveedorRoutes, ...rolRoutes, ...usuarioRoutes, ...auditoriaRoutes, ...moderacionRoutes, ...eventoRoutes, ...carroRoutes, ...ordenRoutes, ...documentoTributarioRoutes, ...reembolsoRoutes, ...estadisticasRoutes, ...liquidacionRoutes, ...dashboardRoutes];

export async function registerRoutes(app: FastifyInstance) {
  routes.forEach((route) => app.route(route));
}
