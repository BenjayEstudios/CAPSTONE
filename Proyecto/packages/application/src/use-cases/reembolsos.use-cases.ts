import {
  buscarReembolsoQuerySchema,
  crearReembolsoSchema,
  type ContextoEmision,
  type DocumentoTributarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { desglosarIva, emitirDocumentosOrden, presentarDocumento, urlPdf } from "./documentos-tributarios.use-cases.js";

// KAN-120. Reembolso total o parcial = nota de credito (DTE 61, simulada) + actualizacion del pago.
// Decisiones (el enum estado_pago no tiene "parcial"):
//  - No existe tabla de reembolsos: el acumulado reembolsado = suma de las notas de credito (61) de la orden;
//    el historial y el motivo salen de esas notas + auditoria_log (accion "reembolsar", entidad "orden").
//  - Parcial: estado_pago sigue 'pagado' y la orden no cambia; el saldo reembolsable baja.
//  - Total acumulado (== orden.total): estado_pago = 'reembolsado' y orden.estado = 'reembolsada'.
//  - No cancela envios ni toca liquidaciones (eso es un flujo operativo aparte).

/**
 * PUNTO DE EXTENSION (KAN-148, pasarela de pago): si se entrega `devolverDinero`, se invoca DESPUES de confirmar
 * la transaccion con el monto y la referencia de la pasarela de la orden para devolver el dinero al cliente.
 * Sin hook, el reembolso solo registra el documento y el estado (devolucionPasarela = "no_integrada").
 */
export interface SolicitudDevolucion {
  ordenId: number;
  ordenCodigo: string;
  monto: number;
  referenciaPasarela: string | null;
  notaCreditoId: number;
}
export type DevolverDinero = (s: SolicitudDevolucion) => Promise<void>;

interface Deps {
  documentoRepository: DocumentoTributarioRepository;
  emisorRut?: string;
  devolverDinero?: DevolverDinero;
}

const sumaNotas = (ctx: ContextoEmision) => ctx.documentos.filter((d) => d.tipoDte === 61).reduce((t, d) => t + d.total, 0);

async function resumen(deps: Deps, ordenId: number) {
  const ctx = await deps.documentoRepository.contextoOrden(ordenId);
  if (!ctx) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", "Orden no encontrada");
  const registros = await deps.documentoRepository.listarReembolsos(ordenId);
  const reembolsado = sumaNotas(ctx);
  const saldo = Math.max(0, ctx.orden.total - reembolsado);
  return {
    orden: {
      id: ctx.orden.id,
      codigo: ctx.orden.codigo,
      estado: ctx.orden.estado,
      estadoPago: ctx.orden.estadoPago,
      total: ctx.orden.total,
      pagadoEn: ctx.orden.pagadoEn,
      cliente: ctx.clienteNombre,
      organizacion: ctx.organizacionNombre
    },
    reembolsado,
    saldo,
    reembolsable: ctx.orden.estadoPago === "pagado" && saldo > 0,
    items: registros.map((r) => ({
      id: r.nota.id,
      folio: r.nota.folio,
      monto: r.nota.total,
      motivo: r.motivo,
      usuarioId: r.usuarioId,
      creadoEn: r.creadoEn,
      pdfUrl: urlPdf(r.nota.id)
    }))
  };
}

export function listarReembolsosOrden(deps: Deps) {
  return (ordenId: number) => resumen(deps, ordenId);
}

/** Busca una orden por su folio visible (CM-90412) y devuelve su resumen de reembolsos. */
export function buscarReembolsosPorCodigo(deps: Deps) {
  return async (input: unknown) => {
    const { codigo } = validar(buscarReembolsoQuerySchema, input);
    const id = await deps.documentoRepository.buscarOrdenIdPorCodigo(codigo.toUpperCase());
    if (id === null) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", `No existe la orden ${codigo}`);
    return resumen(deps, id);
  };
}

export function crearReembolso(deps: Deps) {
  return async (usuarioId: number, ordenId: number, input: unknown) => {
    const dto = validar(crearReembolsoSchema, input);
    const previo = await deps.documentoRepository.contextoOrden(ordenId);
    if (!previo) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", "Orden no encontrada");
    if (previo.orden.estadoPago === "pagado") {
      // Garantiza boleta/factura original antes de la nota de credito (idempotente).
      await emitirDocumentosOrden(deps)(ordenId, usuarioId);
    } else if (previo.orden.estadoPago !== "reembolsado") {
      throw new ErrorAplicacion(409, "ORDEN_NO_PAGADA", "La orden no esta pagada: no se puede reembolsar");
    }

    const nota = await deps.documentoRepository.registrarReembolso(ordenId, async (ctx) => {
      const { orden } = ctx;
      if (orden.estadoPago !== "pagado" && orden.estadoPago !== "reembolsado") {
        throw new ErrorAplicacion(409, "ORDEN_NO_PAGADA", "La orden no esta pagada: no se puede reembolsar");
      }
      const original = ctx.documentos.find((d) => d.tipoDte === 33 || d.tipoDte === 39);
      if (!original) throw new ErrorAplicacion(409, "SIN_DOCUMENTO_ORIGINAL", "La orden no tiene boleta ni factura que corregir");
      const reembolsado = sumaNotas(ctx);
      const saldo = orden.total - reembolsado;
      const monto = dto.monto ?? saldo;
      if (saldo <= 0 || monto > saldo) {
        throw new ErrorAplicacion(409, "MONTO_EXCEDE_SALDO", `El monto excede el saldo reembolsable ($${Math.max(0, saldo)})`, {
          saldo: Math.max(0, saldo),
          reembolsado,
          solicitado: monto
        });
      }
      const acumulado = reembolsado + monto;
      const total = acumulado === orden.total;
      return {
        nota: {
          tipoDte: 61,
          ordenId: orden.id,
          ordenEnvioId: null,
          emisorRut: original.emisorRut,
          receptorRut: original.receptorRut,
          ...desglosarIva(monto),
          total: monto
        },
        estadoPago: total ? "reembolsado" : undefined,
        estadoOrden: total ? "reembolsada" : undefined,
        auditoria: (n) => [
          {
            usuarioId,
            entidad: "orden",
            entidadId: orden.id,
            accion: "reembolsar",
            datosAntes: { estado: orden.estado, estadoPago: orden.estadoPago, reembolsado },
            datosDespues: {
              operacion: "reembolso",
              notaCreditoId: n.id,
              folio: n.folio,
              documentoOriginalId: original.id,
              monto,
              motivo: dto.motivo,
              esTotal: total,
              estado: total ? "reembolsada" : orden.estado,
              estadoPago: total ? "reembolsado" : orden.estadoPago,
              reembolsado: acumulado,
              saldo: orden.total - acumulado,
              simulado: true
            }
          }
        ]
      };
    });

    let devolucionPasarela: "no_integrada" | "ok" | "error" = "no_integrada";
    if (deps.devolverDinero) {
      try {
        await deps.devolverDinero({
          ordenId,
          ordenCodigo: previo.orden.codigo,
          monto: nota.total,
          referenciaPasarela: previo.orden.referenciaPasarela,
          notaCreditoId: nota.id
        });
        devolucionPasarela = "ok";
      } catch {
        devolucionPasarela = "error";
      }
    }
    return { ...(await resumen(deps, ordenId)), notaCredito: presentarDocumento(nota, previo.orden.codigo), devolucionPasarela };
  };
}
