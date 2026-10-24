import type { AlmacenArchivos } from "@cotizapp/domain";
import type { DbClient } from "@cotizapp/infrastructure";

declare module "fastify" {
  interface FastifyInstance {
    db: DbClient;
    almacenArchivos: AlmacenArchivos;
    uploadsMaxBytes: number;
  }
}
