import cors from "@fastify/cors";
import Fastify from "fastify";
import { errorHandler } from "../lib/error-handler.js";
import { createDbClient } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { registerRoutes } from "../routes/index.js";

export async function buildApp(env: Env) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: env.CORS_ORIGIN });

  // Composition root: se arman los adaptadores de infraestructura y se
  // conectan a los casos de uso de @cotizapp/application. Sin service-locator:
  // las dependencias se pasan explícitamente a cada caso de uso.
  const { db, pool } = createDbClient(env.DATABASE_URL);
  await pool.query("SELECT 1");
  logger.info("MySQL successfully connected");
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  return app;
}
