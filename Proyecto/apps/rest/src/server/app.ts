import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";
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

  app.setErrorHandler((error: FastifyError, request, reply) => {
    logger.error(error.message, { method: request.method, url: request.url, err: error });
    reply.status(error.statusCode ?? 500).send({
      error: {
        code: error.code ?? "INTERNAL_ERROR",
        message: error.message
      }
    });
  });

  await registerRoutes(app);

  return app;
}
