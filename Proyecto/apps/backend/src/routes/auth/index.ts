import type { RouteOptions } from "fastify";
import { loginAdminRoute } from "./login-admin.js";
import { loginRoute } from "./login.js";
import { meRoute } from "./me.js";
import { mfaAdminRoute, mfaConfirmarRoute, mfaEnrolarRoute } from "./mfa.js";
import { solicitarRecuperacionRoute, restablecerClaveRoute } from "./recuperacion.js";
import { registroCompradorRoute, registroProveedorRoute } from "./registro.js";

export const authRoutes: RouteOptions[] = [
  loginRoute,
  loginAdminRoute,
  mfaAdminRoute,
  mfaEnrolarRoute,
  mfaConfirmarRoute,
  meRoute,
  registroCompradorRoute,
  registroProveedorRoute,
  solicitarRecuperacionRoute,
  restablecerClaveRoute
];
