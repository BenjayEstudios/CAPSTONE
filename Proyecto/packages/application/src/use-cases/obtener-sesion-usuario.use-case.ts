import type { UsuarioRepository, UsuarioSesionDto } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { aSesionUsuario } from "./login-admin.use-case.js";

// GET /auth/me: relee usuario, rol y permisos desde la DB para que el
// frontend refresque permisos sin volver a loguearse.
export function obtenerSesionUsuario(deps: { usuarioRepository: UsuarioRepository }) {
  return async (usuarioId: number): Promise<UsuarioSesionDto> => {
    const ctx = Number.isInteger(usuarioId) ? await deps.usuarioRepository.buscarPorId(usuarioId) : null;
    if (!ctx || ctx.usuario.estado !== "activo") {
      throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    }
    return aSesionUsuario(ctx);
  };
}
