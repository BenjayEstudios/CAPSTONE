import {
  CalificacionError,
  calificarEnvioSchema,
  type CalificacionRepository,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

interface Deps {
  calificacionRepository: CalificacionRepository;
  usuarioRepository: UsuarioRepository;
}

/**
 * POST /ordenes/envios/:id/calificacion (KAN-99): el comprador califica al
 * proveedor de un envio entregado, una vez. Que el envio este entregado y sea
 * de su organizacion lo garantiza el repositorio (INSERT ... SELECT); aqui se
 * traduce su error a la API.
 */
export function calificarEnvio(deps: Deps) {
  return async (usuarioId: number, ordenEnvioId: number, input: unknown) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    if (ctx.organizacion.tipo !== "cliente") throw new ErrorAplicacion(403, "FORBIDDEN", "Solo un comprador califica a sus proveedores");
    const dto = validar(calificarEnvioSchema, input ?? {});
    try {
      return await deps.calificacionRepository.registrar({ ordenEnvioId, usuarioId, puntaje: dto.puntaje, comentario: dto.comentario });
    } catch (err) {
      if (err instanceof CalificacionError) {
        if (err.codigo === "ya_calificado") throw new ErrorAplicacion(409, "YA_CALIFICADO", "Este envio ya fue calificado");
        if (err.codigo === "envio_no_calificable") {
          throw new ErrorAplicacion(409, "ENVIO_NO_CALIFICABLE", "Solo se califica un envio entregado de tus ordenes");
        }
        throw new ErrorAplicacion(400, "VALIDACION", "puntaje: debe estar entre 1 y 5");
      }
      throw err;
    }
  };
}
