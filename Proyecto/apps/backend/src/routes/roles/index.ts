import type { RouteOptions } from "fastify";
import { listRolesRoute } from "./list.js";
import { updatePermisosRolRoute } from "./update-permisos.js";

export const rolRoutes: RouteOptions[] = [listRolesRoute, updatePermisosRolRoute];
