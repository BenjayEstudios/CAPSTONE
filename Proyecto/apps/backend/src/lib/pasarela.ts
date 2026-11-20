import type { PasarelaPago } from "@cotizapp/domain";
import { WEBPAY_INTEGRACION, WEBPAY_URL_INTEGRACION, WEBPAY_URL_PRODUCCION, WebpayPlus } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";

// Selector del adaptador de PasarelaPago (KAN-95). Hoy solo Webpay Plus; en
// integracion, sin credenciales propias, usa las publicas de prueba.
export function crearPasarelaPago(
  env: Pick<Env, "WEBPAY_ENTORNO" | "WEBPAY_CODIGO_COMERCIO" | "WEBPAY_API_KEY">
): PasarelaPago {
  const produccion = env.WEBPAY_ENTORNO === "produccion";
  return new WebpayPlus({
    codigoComercio: env.WEBPAY_CODIGO_COMERCIO ?? WEBPAY_INTEGRACION.codigoComercio,
    apiKey: env.WEBPAY_API_KEY ?? WEBPAY_INTEGRACION.apiKey,
    baseUrl: produccion ? WEBPAY_URL_PRODUCCION : WEBPAY_URL_INTEGRACION
  });
}
