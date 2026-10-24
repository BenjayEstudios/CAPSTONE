// Error de aplicacion con codigo HTTP sugerido. La capa HTTP (Fastify) lo
// serializa como { error: { code, message } } usando statusCode y code.
export class ErrorAplicacion extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ErrorAplicacion";
  }
}
