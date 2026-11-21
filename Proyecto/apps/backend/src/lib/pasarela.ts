import type { PasarelaPago } from "@cotizapp/domain";
import { PasarelaSimulada, WEBPAY_INTEGRACION, WEBPAY_URL_INTEGRACION, WEBPAY_URL_PRODUCCION, WebpayPlus } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";

// Selector del adaptador de PasarelaPago (KAN-95). Webpay Plus; en
// integracion, sin credenciales propias, usa las publicas de prueba. Con
// PASARELA=simulada (KAN-164, nunca en produccion) aprueba sin Transbank.
export function crearPasarelaPago(
  env: Pick<Env, "WEBPAY_ENTORNO" | "WEBPAY_CODIGO_COMERCIO" | "WEBPAY_API_KEY"> & Partial<Pick<Env, "PASARELA">>
): PasarelaPago {
  if (env.PASARELA === "simulada") return new PasarelaSimulada();
  const produccion = env.WEBPAY_ENTORNO === "produccion";
  return new WebpayPlus({
    codigoComercio: env.WEBPAY_CODIGO_COMERCIO ?? WEBPAY_INTEGRACION.codigoComercio,
    apiKey: env.WEBPAY_API_KEY ?? WEBPAY_INTEGRACION.apiKey,
    baseUrl: produccion ? WEBPAY_URL_PRODUCCION : WEBPAY_URL_INTEGRACION
  });
}
