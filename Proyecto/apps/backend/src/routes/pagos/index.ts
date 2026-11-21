import type { FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { confirmarRetornoPago, emitirDocumentosOrden, iniciarPago, notificarOrdenPagada } from "@cotizapp/application";
import { DrizzleDocumentoTributarioRepository, DrizzleOrdenRepository, DrizzleProveedorRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { logger } from "../../lib/logger.js";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

// Pago de la orden con Webpay Plus (KAN-95; la pasarela es KAN-148).
// 1. POST /ordenes/:id/pago -> { urlPago, token }: el ecommerce envia token_ws a urlPago.
// 2. Webpay devuelve al comprador a /pagos/webpay/retorno (GET o POST de formulario).
// 3. El retorno confirma, marca la orden y redirige al ecommerce con el resultado.

export const RUTA_RETORNO_WEBPAY = "/pagos/webpay/retorno";
export const RUTA_RETORNO_PAYPAL = "/pagos/paypal/retorno";

export const iniciarPagoRoute: RouteOptions = {
  method: "POST",
  url: "/ordenes/:id/pago",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request, reply) => {
    const r = await iniciarPago({
      ordenRepository: new DrizzleOrdenRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db),
      pasarela: request.server.pasarelaPago,
      urlRetorno: request.server.publicBaseUrl + (request.server.pasarelaPago.nombre === "paypal" ? RUTA_RETORNO_PAYPAL : RUTA_RETORNO_WEBPAY)
    })(Number(request.auth?.sub), idParamSchema.parse(request.params).id, request.body);
    return reply.status(201).send(r);
  }
};

async function retorno(request: FastifyRequest, reply: FastifyReply, datosPasarela?: unknown) {
  const db = request.server.db;
  const datos = datosPasarela ?? (request.method === "POST" ? request.body : request.query);
  const r = await confirmarRetornoPago({
    ordenRepository: new DrizzleOrdenRepository(db),
    pasarela: request.server.pasarelaPago,
    // Boleta o factura y guias de despacho (DTE simulados, KAN-153).
    alAprobar: async (ordenId) => {
      await emitirDocumentosOrden({ documentoRepository: new DrizzleDocumentoTributarioRepository(db), emisorRut: process.env.SII_EMISOR_RUT || undefined })(ordenId);
    },
    // Correos de confirmacion al comprador y aviso a cada proveedor (KAN-156).
    alPagar: (ordenId) =>
      notificarOrdenPagada({
        ordenRepository: new DrizzleOrdenRepository(db),
        usuarioRepository: new DrizzleUsuarioRepository(db),
        proveedorRepository: new DrizzleProveedorRepository(db),
        servicioCorreo: request.server.servicioCorreo,
        urlPanelProveedor: `${request.server.ecommerceUrl.replace(/\/$/, "")}/proveedor/ventas`,
        log: (mensaje, error) => logger.error(mensaje, { error: error instanceof Error ? error.message : String(error) })
      })(ordenId),
    log: (mensaje, error) => logger.error(mensaje, { error: error instanceof Error ? error.message : String(error) })
  })(datos);
  const base = request.server.ecommerceUrl.replace(/\/$/, "");
  const destino = r.ordenId
    ? `${base}/checkout/resultado?orden=${r.ordenId}&pago=${r.resultado}`
    : `${base}/carro?pago=${r.resultado}`;
  // 303: el navegador sigue con GET aunque Webpay haya llegado por POST.
  return reply.redirect(destino, 303);
}

// Publica: la llama el navegador del comprador al volver de Webpay.
export const retornoWebpayGetRoute: RouteOptions = { method: "GET", url: RUTA_RETORNO_WEBPAY, handler: retorno };
export const retornoWebpayPostRoute: RouteOptions = { method: "POST", url: RUTA_RETORNO_WEBPAY, handler: retorno };

/**
 * PayPal vuelve con GET ?token=<id de la orden de PayPal>&PayerID=... si el
 * comprador aprobo, o con resultado=cancelado (lo agrega el adaptador a la
 * cancel_url) si anulo. Se traduce a la forma que entiende confirmarRetornoPago
 * (token_ws = confirmar; TBK_TOKEN = anulado).
 */
export function datosRetornoPayPal(query: unknown): { token_ws?: string; TBK_TOKEN?: string } {
  const q = (query ?? {}) as { token?: unknown; resultado?: unknown };
  const token = typeof q.token === "string" && q.token ? q.token : undefined;
  if (!token) return {};
  return q.resultado === "cancelado" ? { TBK_TOKEN: token } : { token_ws: token };
}

export const retornoPayPalRoute: RouteOptions = {
  method: "GET",
  url: RUTA_RETORNO_PAYPAL,
  handler: (request, reply) => retorno(request, reply, datosRetornoPayPal(request.query))
};

export const pagoRoutes: RouteOptions[] = [iniciarPagoRoute, retornoWebpayGetRoute, retornoWebpayPostRoute, retornoPayPalRoute];
