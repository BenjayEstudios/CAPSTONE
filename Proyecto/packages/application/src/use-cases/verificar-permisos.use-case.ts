import type { NivelPermiso, UsuarioRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

export interface RequisitoPermiso {
  codigo: string;
  // Nivel minimo aceptado. Por defecto "parcial" (parcial o total).
  minimo?: Exclude<NivelPermiso, "ninguno">;
}

const RANGO: Record<NivelPermiso, number> = { ninguno: 0, parcial: 1, total: 2 };

export function cumpleRequisito(permisos: Record<string, NivelPermiso | undefined>, req: RequisitoPermiso): boolean {
  const nivel = permisos[req.codigo] ?? "ninguno";
  return RANGO[nivel] >= RANGO[req.minimo ?? "parcial"] && RANGO[nivel] > 0;
}

// Autoriza a un usuario leyendo SIEMPRE rol y estado desde la DB (no del
// JWT): los cambios de la matriz rol.permisos y las suspensiones aplican de
// inmediato. Basta cumplir UNO de los requisitos (OR).
// 401: usuario inexistente o no activo. 403: ningun requisito cumplido.
export function verificarPermisos(deps: { usuarioRepository: UsuarioRepository }) {
  return async (usuarioId: number, requisitos: RequisitoPermiso[]) => {
    const ctx = Number.isInteger(usuarioId) ? await deps.usuarioRepository.buscarPorId(usuarioId) : null;
    if (!ctx || ctx.usuario.estado !== "activo") {
      throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    }
    if (!requisitos.some((r) => cumpleRequisito(ctx.rol.permisos, r))) {
      throw new ErrorAplicacion(403, "FORBIDDEN", "No tienes permiso para esto");
    }
    return ctx;
  };
}
