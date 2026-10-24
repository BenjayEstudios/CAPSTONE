import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "./logger.js";

interface ZodLikeError {
  name: string;
  issues: Array<{ path: Array<string | number>; message: string }>;
}

function esZodError(e: unknown): e is ZodLikeError {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "ZodError" && Array.isArray((e as ZodLikeError).issues);
}

// Codigo de error de MySQL, tambien cuando Drizzle lo envuelve en `cause`.
function codigoMysql(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.cause?.code ?? err?.code;
}

// Todos los errores salen como { error: { code, message } }:
// - ZodError (validacion sin pasar por el caso de uso: params/query/body) -> 400 VALIDACION
// - ErrorAplicacion / errores de Fastify -> su statusCode y code
// - violacion de unicidad de MySQL (carrera entre dos requests) -> 409 DUPLICADO
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (esZodError(error)) {
    const detalle = error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
    return reply.status(400).send({ error: { code: "VALIDACION", message: detalle } });
  }
  if (codigoMysql(error) === "ER_DUP_ENTRY") {
    return reply.status(409).send({ error: { code: "DUPLICADO", message: "Ya existe un registro con ese valor unico" } });
  }
  logger.error(error.message, { method: request.method, url: request.url, err: error });
  return reply.status(error.statusCode ?? 500).send({
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      message: error.message,
      ...((error as { detalle?: unknown }).detalle !== undefined ? { detalle: (error as { detalle?: unknown }).detalle } : {})
    }
  });
}
