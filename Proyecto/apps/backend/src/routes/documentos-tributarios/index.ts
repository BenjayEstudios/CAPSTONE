import type { FastifyRequest, RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { descargarPdfDocumento, emitirDocumentosOrden, listarDocumentos } from "@cotizapp/application";
import { DrizzleDocumentoTributarioRepository, DrizzleUsuarioRepository } from "@cotizapp/infrastructure";
import { requireAuth, requirePermiso } from "../../plugins/auth.js";

const deps = (request: FastifyRequest) => ({
  documentoRepository: new DrizzleDocumentoTributarioRepository(request.server.db),
  usuarioRepository: new DrizzleUsuarioRepository(request.server.db),
  // DTE SIMULADOS (KAN-153): RUT del emisor de boleta/factura/NC; la integracion real con el SII esta fuera del MVP.
  emisorRut: process.env.SII_EMISOR_RUT || undefined
});
const uid = (request: FastifyRequest) => Number(request.auth?.sub);
// Admin (ver_todas_ordenes), cliente dueño (ver_ordenes_propias) y proveedor (solo guias de sus envios): el alcance lo resuelve el caso de uso.
const preHandler = [requireAuth, requirePermiso("ver_ordenes_propias", "ver_todas_ordenes")];

// ?ordenId=&tipo=&pagina=&tamano=
export const listDocumentosRoute: RouteOptions = {
  method: "GET",
  url: "/documentos-tributarios",
  preHandler,
  handler: async (request) => listarDocumentos(deps(request))(uid(request), request.query)
};

export const pdfDocumentoRoute: RouteOptions = {
  method: "GET",
  url: "/documentos-tributarios/:id/pdf",
  preHandler,
  handler: async (request, reply) => {
    const { nombre, contenido } = await descargarPdfDocumento(deps(request))(uid(request), idParamSchema.parse(request.params).id);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="${nombre}"`)
      .send(Buffer.from(contenido));
  }
};

// Hasta que KAN-148 invoque emitirDocumentosOrden al confirmar el pago, un admin puede dispararlo (idempotente).
export const emitirDocumentosRoute: RouteOptions = {
  method: "POST",
  url: "/ordenes/:id/documentos",
  preHandler: [requireAuth, requirePermiso({ codigo: "ver_todas_ordenes", minimo: "total" })],
  handler: async (request, reply) => {
    const r = await emitirDocumentosOrden(deps(request))(idParamSchema.parse(request.params).id, uid(request));
    return reply.status(r.nuevos > 0 ? 201 : 200).send(r);
  }
};

export const documentoTributarioRoutes: RouteOptions[] = [listDocumentosRoute, pdfDocumentoRoute, emitirDocumentosRoute];
