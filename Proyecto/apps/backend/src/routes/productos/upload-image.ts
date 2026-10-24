import { randomUUID } from "node:crypto";
import type { RouteOptions } from "fastify";
import { idParamSchema } from "@cotizapp/domain";
import { ErrorAplicacion, subirImagenProducto } from "@cotizapp/application";
import { DrizzleProductoRepository } from "@cotizapp/infrastructure";
import { REQUISITO_CARGAR_IMAGENES, requireAuth, requirePermiso } from "../../plugins/auth.js";

// Sube UN archivo (multipart, campo cualquiera) al almacen y devuelve
// { url, ancho, alto, clave }. NO registra la imagen en el producto: el
// cliente llama despues a PUT /productos/:id/imagenes con esos metadatos.
// Requiere @fastify/multipart registrado en la app (server/app.ts).
export const uploadImagenProductoRoute: RouteOptions = {
  method: "POST",
  url: "/productos/:id/imagenes/archivo",
  preHandler: [requireAuth, requirePermiso(REQUISITO_CARGAR_IMAGENES)],
  handler: async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const parte = await request.file();
    if (!parte) throw new ErrorAplicacion(400, "ARCHIVO_REQUERIDO", "Falta el archivo (multipart/form-data)");
    // toBuffer lanza 413 FST_REQ_FILE_TOO_LARGE si supera limits.fileSize.
    const contenido = await parte.toBuffer();
    const resultado = await subirImagenProducto({
      productoRepository: new DrizzleProductoRepository(request.server.db),
      almacenArchivos: request.server.almacenArchivos,
      generarId: randomUUID,
      tamanoMaximoBytes: request.server.uploadsMaxBytes
    })(id, contenido);
    reply.status(201);
    return resultado;
  }
};
