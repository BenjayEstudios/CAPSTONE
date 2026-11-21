import {
  iniciarPagoSchema,
  retornoWebpaySchema,
  type Orden,
  type OrdenRepository,
  type PasarelaPago,
  type TransaccionPago,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

// Pago de una orden (KAN-95, base de KAN-148). La orden nace en
// pendiente_pago con POST /carro/confirmar; aqui se cobra una vez por el total
// de la orden en la pasarela y, al volver el comprador, se confirma.

interface DepsInicio {
  ordenRepository: OrdenRepository;
  usuarioRepository: UsuarioRepository;
  pasarela: PasarelaPago;
  /** URL publica de nuestro retorno (GET|POST /pagos/webpay/retorno). */
  urlRetorno: string;
}

/** sesion_id que viaja por la pasarela y vuelve en el retorno. */
export const sesionDeOrden = (ordenId: number) => `orden-${ordenId}`;
const ordenDeSesion = (sesion: string | undefined) => {
  const m = /^orden-(\d+)$/.exec(sesion ?? "");
  return m ? Number(m[1]) : null;
};

/**
 * Orden de compra para la pasarela: el folio, y en un reintento el folio con
 * un sufijo (Webpay no acepta repetir la orden de compra). Maximo 26 caracteres.
 */
export function ordenCompraDe(orden: Pick<Orden, "codigo" | "referenciaPasarela">, ahora = Date.now()): string {
  return orden.referenciaPasarela ? `${orden.codigo}-${ahora.toString(36)}`.slice(0, 26) : orden.codigo;
}

export function iniciarPago(deps: DepsInicio) {
  return async (usuarioId: number, ordenId: number, input: unknown) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    if (ctx.organizacion.tipo !== "cliente") throw new ErrorAplicacion(403, "FORBIDDEN", "Solo un comprador paga sus ordenes");
    const dto = validar(iniciarPagoSchema, input ?? {});
    if (dto.medioPago !== "tarjeta") {
      throw new ErrorAplicacion(409, "MEDIO_PAGO_NO_DISPONIBLE", "Por ahora solo se puede pagar con tarjeta (Webpay)");
    }
    const oc = await deps.ordenRepository.buscarPorId(ordenId, { tipo: "cliente", usuarioId });
    if (!oc) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", "Orden no encontrada");
    if (oc.orden.estado !== "pendiente_pago") throw new ErrorAplicacion(409, "ORDEN_YA_PAGADA", "La orden ya fue pagada");

    const inicio = await deps.pasarela.iniciar({
      ordenCompra: ordenCompraDe(oc.orden),
      sesionId: sesionDeOrden(oc.orden.id),
      monto: oc.orden.total,
      urlRetorno: deps.urlRetorno
    });
    await deps.ordenRepository.registrarInicioPago(oc.orden.id, inicio.token);
    return { ordenId: oc.orden.id, codigo: oc.orden.codigo, total: oc.orden.total, pasarela: deps.pasarela.nombre, urlPago: inicio.url, token: inicio.token, metodo: inicio.metodo ?? "POST" };
  };
}

interface DepsRetorno {
  ordenRepository: OrdenRepository;
  pasarela: PasarelaPago;
  /** Se llama al aprobar (emitirDocumentosOrden). Un error no revierte el pago. */
  alAprobar?: (ordenId: number) => Promise<unknown>;
  /** Se llama al aprobar (correos, KAN-156). Independiente de alAprobar; un error no revierte el pago. */
  alPagar?: (ordenId: number) => Promise<unknown>;
  log?: (mensaje: string, error?: unknown) => void;
}

export type ResultadoRetorno = "aprobado" | "rechazado" | "anulado" | "error";

/**
 * Retorno del comprador desde Webpay Plus. Nunca lanza: devuelve a que orden
 * volver y con que resultado, y la ruta redirige al ecommerce.
 * - token_ws: flujo normal. Se confirma (commit) y se aplica el resultado; si
 *   la orden ya no estaba pendiente (retorno repetido) no se confirma de nuevo.
 * - TBK_TOKEN: el comprador anulo. Si el token es el de la orden, queda fallido.
 * - Solo TBK_ID_SESION: se agoto el tiempo. La orden sigue pendiente.
 */
export function confirmarRetornoPago(deps: DepsRetorno) {
  return async (input: unknown): Promise<{ ordenId: number | null; resultado: ResultadoRetorno }> => {
    const p = retornoWebpaySchema.safeParse(input ?? {});
    if (!p.success) return { ordenId: null, resultado: "error" };
    const { token_ws: token, TBK_TOKEN: tokenAnulado, TBK_ID_SESION: sesion } = p.data;

    if (token && !tokenAnulado) {
      const orden = await deps.ordenRepository.buscarPorReferenciaPasarela(token);
      if (!orden) return { ordenId: null, resultado: "error" };
      if (orden.estado !== "pendiente_pago") {
        return { ordenId: orden.id, resultado: orden.estadoPago === "pagado" ? "aprobado" : "rechazado" };
      }
      let tx: TransaccionPago;
      try {
        tx = await deps.pasarela.confirmar(token);
      } catch (err) {
        deps.log?.(`No se pudo confirmar el pago de la orden ${orden.id}`, err);
        return { ordenId: orden.id, resultado: "error" };
      }
      // El monto cobrado tiene que ser el total de la orden; si no, no se da por pagada.
      const aprobado = tx.aprobado && tx.monto === orden.total;
      const aplicado = await deps.ordenRepository.registrarResultadoPago(
        orden.id,
        { aprobado, medioPago: "tarjeta", referencia: token },
        {
          usuarioId: null,
          entidad: "orden",
          entidadId: orden.id,
          accion: "editar",
          datosAntes: { estado: orden.estado, estadoPago: orden.estadoPago },
          datosDespues: {
            operacion: aprobado ? "pago_aprobado" : "pago_rechazado",
            pasarela: deps.pasarela.nombre,
            monto: tx.monto,
            codigoAutorizacion: tx.codigoAutorizacion,
            codigoRespuesta: tx.codigoRespuesta,
            tipoTarjeta: tx.tipoTarjeta,
            ultimosDigitos: tx.ultimosDigitos
          }
        }
      );
      if (aplicado && aprobado && deps.alAprobar) {
        try {
          await deps.alAprobar(orden.id);
        } catch (err) {
          deps.log?.(`Pago aprobado, pero fallo la emision de documentos de la orden ${orden.id}`, err);
        }
      }
      if (aplicado && aprobado && deps.alPagar) {
        try {
          await deps.alPagar(orden.id);
        } catch (err) {
          deps.log?.(`Pago aprobado, pero fallo el aviso por correo de la orden ${orden.id}`, err);
        }
      }
      return { ordenId: orden.id, resultado: aprobado ? "aprobado" : "rechazado" };
    }

    if (tokenAnulado) {
      const orden = await deps.ordenRepository.buscarPorReferenciaPasarela(tokenAnulado);
      if (!orden) return { ordenId: ordenDeSesion(sesion), resultado: "anulado" };
      if (orden.estado === "pendiente_pago") {
        await deps.ordenRepository.registrarResultadoPago(
          orden.id,
          { aprobado: false, medioPago: "tarjeta", referencia: tokenAnulado },
          {
            usuarioId: null,
            entidad: "orden",
            entidadId: orden.id,
            accion: "editar",
            datosAntes: { estado: orden.estado, estadoPago: orden.estadoPago },
            datosDespues: { operacion: "pago_anulado", pasarela: deps.pasarela.nombre }
          }
        );
      }
      return { ordenId: orden.id, resultado: "anulado" };
    }

    return { ordenId: ordenDeSesion(sesion), resultado: "anulado" };
  };
}
