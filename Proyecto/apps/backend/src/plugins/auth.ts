import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { verificarPermisos, type RequisitoPermiso } from "@cotizapp/application";
import { DrizzleUsuarioRepository } from "@cotizapp/infrastructure";

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

// JWT_SECRET esta validado por apps/backend/src/config/env.ts (envSchema): si
// falta, loadEnv() ya hizo explotar el arranque del server antes de que
// esta linea se ejecute con ningun request real.
const JWT_SECRET = process.env.JWT_SECRET;

// preHandler: el hook nativo de Fastify para esto. Se aplica por ruta o por
// grupo de rutas (ver apps/backend/src/routes/categorias/index.ts) — nunca
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

// Guard de permisos: compone despues de requireAuth. Lee rol y estado
// vigentes desde la DB (NO del JWT) para respetar cambios de la matriz
// rol.permisos y usuarios suspendidos. Basta cumplir UNO de los requisitos
// (OR). Acepta codigos ("crear_producto" = parcial o total) o
// { codigo, minimo: "total" }. 401 si el usuario no existe / no esta activo;
// 403 FORBIDDEN si el nivel es "ninguno" o ausente. Los errores los
// serializa lib/error-handler.ts.
export function requirePermiso(...requisitos: Array<string | RequisitoPermiso>) {
  const reqs: RequisitoPermiso[] = requisitos.map((r) => (typeof r === "string" ? { codigo: r } : r));
  return async (request: FastifyRequest) => {
    const usuarioRepository = new DrizzleUsuarioRepository(request.server.db);
    await verificarPermisos({ usuarioRepository })(Number(request.auth?.sub), reqs);
  };
}

// Lectura del catalogo de administracion (listar/ver productos, categorias
// ocultas): crear_producto (parcial o total) o cargar_imagenes en "total".
// cargar_imagenes "parcial" (proveedor: solo sus productos, sin modelo de
// pertenencia todavia) NO alcanza para ver/escribir el catalogo global.
export const REQUISITOS_LECTURA_CATALOGO: RequisitoPermiso[] = [
  { codigo: "crear_producto" },
  { codigo: "cargar_imagenes", minimo: "total" }
];
export const REQUISITO_CARGAR_IMAGENES: RequisitoPermiso = { codigo: "cargar_imagenes", minimo: "total" };
