import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export interface AuthClaims {
  sub: string; // id del usuario
  organizacionId: number;
  rol: string; // codigo del rol (ver tabla "rol" del DBML)
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthClaims;
  }
}

// JWT_SECRET esta validado por apps/rest/src/config/env.ts (envSchema): si
// falta, loadEnv() ya hizo explotar el arranque del server antes de que
// esta linea se ejecute con ningun request real.
const JWT_SECRET = process.env.JWT_SECRET;

// preHandler: el hook nativo de Fastify para esto. Se aplica por ruta o por
// grupo de rutas (ver apps/rest/src/routes/categorias/index.ts) — nunca
// global, para no tener que mantener una lista de excepciones de rutas
// publicas.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Falta el token" } });
  }

  try {
    request.auth = jwt.verify(token, JWT_SECRET as string) as AuthClaims;
  } catch {
    return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Token invalido o expirado" } });
  }
}

// Guard de rol, para componer con requireAuth cuando la ruta ademas
// necesita un rol especifico (ej. solo "administrador"). requireAuth
// resuelve "¿estas logueado?"; requireRol resuelve "¿tenes permiso?".
export function requireRol(...rolesPermitidos: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth || !rolesPermitidos.includes(request.auth.rol)) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "No tienes permiso para esto" } });
    }
  };
}
