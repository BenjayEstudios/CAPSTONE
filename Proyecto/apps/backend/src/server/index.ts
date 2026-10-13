import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const app = await buildApp(env);

async function shutdown() {
  logger.warn("Graceful shutdown initiated");
  await app.close();
  logger.warn("Server closed gracefully");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const address = await app.listen({ port: env.PORT, host: env.HOST });
logger.all(`Server successfully started on: ${address}`, { address });
logger.info("Press CTRL-C to stop");
