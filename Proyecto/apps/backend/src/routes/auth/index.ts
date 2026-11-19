import type { RouteOptions } from "fastify";
import { loginAdminRoute } from "./login-admin.js";
import { meRoute } from "./me.js";
import { mfaAdminRoute, mfaReenviarRoute } from "./mfa.js";

export const authRoutes: RouteOptions[] = [loginAdminRoute, mfaAdminRoute, mfaReenviarRoute, meRoute];
