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

export const iniciarPagoRoute: RouteOptions = {
  method: "POST",
  url: "/ordenes/:id/pago",
  preHandler: [requireAuth, requirePermiso("ver_ordenes_propias")],
  handler: async (request, reply) => {
    const r = await iniciarPago({
      ordenRepository: new DrizzleOrdenRepository(request.server.db),
      usuarioRepository: new DrizzleUsuarioRepository(request.server.db),
      pasarela: request.server.pasarelaPago,
      urlRetorno: request.server.publicBaseUrl + RUTA_RETORNO_WEBPAY
    })(Number(request.auth?.sub), idParamSchema.parse(request.params).id, request.body);
    return reply.status(201).send(r);
  }
};

async function retorno(request: FastifyRequest, reply: FastifyReply) {
  const db = request.server.db;
  const datos = request.method === "POST" ? request.body : request.query;
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

export const pagoRoutes: RouteOptions[] = [iniciarPagoRoute, retornoWebpayGetRoute, retornoWebpayPostRoute];
