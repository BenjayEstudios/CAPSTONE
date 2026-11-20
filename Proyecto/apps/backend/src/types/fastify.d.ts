import type { AlmacenArchivos, PasarelaPago, ServicioCorreo } from "@cotizapp/domain";
import type { DbClient } from "@cotizapp/infrastructure";

declare module "fastify" {
  interface FastifyInstance {
    db: DbClient;
    almacenArchivos: AlmacenArchivos;
    uploadsMaxBytes: number;
    servicioCorreo: ServicioCorreo;
    adminSiteUrl: string;
    ecommerceUrl: string;
    /** Pasarela de pago (Webpay Plus) y URL publica del backend para su retorno. */
    pasarelaPago: PasarelaPago;
    publicBaseUrl: string;
  }
}
