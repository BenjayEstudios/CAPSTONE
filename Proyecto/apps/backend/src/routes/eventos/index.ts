import type { FastifyRequest, RouteOptions } from "fastify";
import jwt from "jsonwebtoken";
import { registrarEvento, registrarEventosLote } from "@cotizapp/application";
import { DrizzleEventoAnaliticoRepository } from "@cotizapp/infrastructure";
import { crearLimitadorTasa } from "../../lib/rate-limit.js";
import { logger } from "../../lib/logger.js";

// Ingesta PUBLICA (sin token) de eventos analiticos. Defensas: body limitado,
// validacion Zod estricta, limite de tasa por IP y nada de IP/datos personales en DB.
// Env: EVENTOS_RATE_LIMIT_MAX (def. 60 solicitudes) por EVENTOS_RATE_LIMIT_WINDOW_SEC (def. 60 s) por IP.
const num = (v: string | undefined, def: number) => (v && Number(v) > 0 ? Number(v) : def);
const limitarTasa = crearLimitadorTasa({
  max: num(process.env.EVENTOS_RATE_LIMIT_MAX, 60),
  ventanaMs: num(process.env.EVENTOS_RATE_LIMIT_WINDOW_SEC, 60) * 1000
});

const BODY_LIMIT_EVENTO = 2048; // 2 KB
const BODY_LIMIT_LOTE = 16384; // 16 KB (20 eventos)

// Bearer valido -> id de usuario; ausente o invalido -> anonimo (nunca falla).
function usuarioOpcional(request: FastifyRequest): number | null {
  const h = request.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const claims = jwt.verify(h.slice(7), process.env.JWT_SECRET as string) as { sub?: string };
    const id = Number(claims.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

const deps = (request: FastifyRequest) => ({
  eventoRepository: new DrizzleEventoAnaliticoRepository(request.server.db),
  alFallar: (err: unknown) => logger.error("No se pudo registrar evento analitico", { err })
});

const postEventoRoute: RouteOptions = {
  method: "POST",
  url: "/eventos",
  bodyLimit: BODY_LIMIT_EVENTO,
  onRequest: limitarTasa,
  handler: async (request, reply) => {
    await registrarEvento(deps(request))(request.body, usuarioOpcional(request));
    return reply.status(202).send();
  }
};

const postEventosLoteRoute: RouteOptions = {
  method: "POST",
  url: "/eventos/lote",
  bodyLimit: BODY_LIMIT_LOTE,
  onRequest: limitarTasa,
  handler: async (request, reply) => {
    await registrarEventosLote(deps(request))(request.body, usuarioOpcional(request));
    return reply.status(202).send();
  }
};

export const eventoRoutes: RouteOptions[] = [postEventoRoute, postEventosLoteRoute];
