import { mkdirSync } from "node:fs";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { errorHandler } from "../lib/error-handler.js";
import { createDbClient } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";
import { crearAlmacenArchivos } from "../lib/storage.js";
import { crearServicioCorreo } from "../lib/mail.js";
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

  // Archivos subidos: un archivo por request, tope configurable (UPLOADS_MAX_MB).
  const uploadsMaxBytes = Math.floor(env.UPLOADS_MAX_MB * 1024 * 1024);
  app.decorate("uploadsMaxBytes", uploadsMaxBytes);
  app.decorate("almacenArchivos", crearAlmacenArchivos(env));
  app.decorate("servicioCorreo", crearServicioCorreo(env));
  app.decorate("adminSiteUrl", env.ADMIN_SITE_URL);
  await app.register(multipart, { limits: { fileSize: uploadsMaxBytes, files: 1, fields: 5 } });
  // Solo lectura y sin listado de directorios. (Con STORAGE_DRIVER=spaces
  // esto no aplica: las URL apuntan al CDN.)
  const uploadsDir = path.resolve(env.UPLOADS_DIR);
  mkdirSync(uploadsDir, { recursive: true });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/", index: false, list: false, dotfiles: "deny" });

  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  return app;
}
