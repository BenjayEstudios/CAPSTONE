import type { PasarelaPago } from "@cotizapp/domain";
import {
  PasarelaSimulada,
  PayPal,
  PAYPAL_URL_PRODUCCION,
  PAYPAL_URL_SANDBOX,
  WEBPAY_INTEGRACION,
  WEBPAY_URL_INTEGRACION,
  WEBPAY_URL_PRODUCCION,
  WebpayPlus
} from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";

type EnvWebpay = Pick<Env, "WEBPAY_ENTORNO" | "WEBPAY_CODIGO_COMERCIO" | "WEBPAY_API_KEY">;
type EnvPayPal = Partial<Pick<Env, "PAYPAL_ENTORNO" | "PAYPAL_CLIENT_ID" | "PAYPAL_CLIENT_SECRET" | "PAYPAL_CLP_POR_USD">>;

// Selector del adaptador de PasarelaPago (KAN-95, KAN-148).
//  - PASARELA=paypal: sandbox de PayPal (credenciales PAYPAL_CLIENT_ID/SECRET);
//    es lo que se usa mientras no exista cuenta empresa de Webpay.
//  - PASARELA=webpay (default): Webpay Plus; en integracion, sin credenciales
//    propias, usa las publicas de prueba.
//  - PASARELA=simulada (KAN-164, nunca en produccion): aprueba sin pasarela.
export function crearPasarelaPago(env: EnvWebpay & EnvPayPal & Partial<Pick<Env, "PASARELA">>): PasarelaPago {
  if (env.PASARELA === "simulada") return new PasarelaSimulada();
  if (env.PASARELA === "paypal") {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("PASARELA=paypal requiere PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET");
    return new PayPal({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      baseUrl: env.PAYPAL_ENTORNO === "produccion" ? PAYPAL_URL_PRODUCCION : PAYPAL_URL_SANDBOX,
      clpPorUsd: env.PAYPAL_CLP_POR_USD
    });
  }
  const produccion = env.WEBPAY_ENTORNO === "produccion";
  return new WebpayPlus({
    codigoComercio: env.WEBPAY_CODIGO_COMERCIO ?? WEBPAY_INTEGRACION.codigoComercio,
    apiKey: env.WEBPAY_API_KEY ?? WEBPAY_INTEGRACION.apiKey,
    baseUrl: produccion ? WEBPAY_URL_PRODUCCION : WEBPAY_URL_INTEGRACION
  });
}
