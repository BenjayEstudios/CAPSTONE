import type { RouteOptions } from "fastify";
import { loginAdminRoute } from "./login-admin.js";
import { meRoute } from "./me.js";

export const authRoutes: RouteOptions[] = [loginAdminRoute, meRoute];
