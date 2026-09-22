import type { DbClient } from "@cotizapp/infrastructure";

declare module "fastify" {
  interface FastifyInstance {
    db: DbClient;
  }
}
