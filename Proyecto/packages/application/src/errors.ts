// Error de aplicacion con codigo HTTP sugerido. La capa HTTP (Fastify) lo
// serializa como { error: { code, message } } usando statusCode y code.
export class ErrorAplicacion extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    // Informacion estructurada opcional (ej. lineas con stock insuficiente); sale en error.detalle.
    readonly detalle?: unknown
  ) {
    super(message);
    this.name = "ErrorAplicacion";
  }
}
