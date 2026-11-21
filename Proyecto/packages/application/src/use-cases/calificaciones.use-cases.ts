import {
  CalificacionError,
  calificacionesRecibidasQuerySchema,
  calificarEnvioSchema,
  type CalificacionRepository,
  type ProveedorRepository,
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

interface DepsRecibidas {
  calificacionRepository: CalificacionRepository;
  usuarioRepository: UsuarioRepository;
  proveedorRepository: Pick<ProveedorRepository, "perfil">;
}

/**
 * GET /calificaciones/recibidas (KAN-200, KAN-135 en mobile): lo que el
 * proveedor de la sesion recibio. Shape de apps/mobile/API_CONTRACT.md
 * (`resumen`, `entregasATiempoPct`, `items`) mas `total`, `pagina` y `tamano`
 * para paginar. Solo usuarios activos de una organizacion proveedor.
 */
export function calificacionesRecibidas(deps: DepsRecibidas) {
  return async (usuarioId: number, query: unknown) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    if (ctx.organizacion.tipo !== "proveedor") throw new ErrorAplicacion(403, "FORBIDDEN", "Solo un proveedor ve sus calificaciones");
    const q = validar(calificacionesRecibidasQuerySchema, query ?? {});
    const proveedorId = ctx.organizacion.id;
    const [resumen, pagina, perfil] = await Promise.all([
      deps.calificacionRepository.resumenRecibidas(proveedorId),
      deps.calificacionRepository.listarRecibidas(proveedorId, q),
      deps.proveedorRepository.perfil(proveedorId)
    ]);
    return {
      resumen,
      entregasATiempoPct: perfil?.entregasATiempoPct ?? null,
      items: pagina.items,
      total: pagina.total,
      pagina: q.pagina,
      tamano: q.tamano
    };
  };
}
