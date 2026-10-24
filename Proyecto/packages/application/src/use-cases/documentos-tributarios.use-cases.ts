import {
  listarDocumentosQuerySchema,
  type ContextoEmision,
  type DocumentoTributario,
  type DocumentoTributarioRepository,
  type NuevoDocumento,
  type TipoDte,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { generarPdfDocumento, NOMBRE_DTE } from "./documento-pdf.js";
import { resolverAlcance } from "./ordenes.use-cases.js";

// KAN-153. Documentos tributarios SIMULADOS: la integracion real con el SII (firma, envio, track id,
// aceptacion) esta fuera del alcance del MVP. Los DTE se "aceptan" al instante con un track id ficticio.

// RUT del emisor de boleta/factura/nota de credito (la plataforma). Configurable via SII_EMISOR_RUT (ver rutas).
export const EMISOR_RUT_POR_DEFECTO = "76000000-0";
export const IVA_PCT = 19;

interface DepsEmision {
  documentoRepository: DocumentoTributarioRepository;
  emisorRut?: string;
}
interface DepsConsulta {
  documentoRepository: DocumentoTributarioRepository;
  usuarioRepository: UsuarioRepository;
}

/** Los montos de la orden son brutos (IVA incluido): neto = total / 1.19 redondeado; iva = total - neto. */
export function desglosarIva(total: number): { neto: number; iva: number } {
  const neto = Math.round((total * 100) / (100 + IVA_PCT));
  return { neto, iva: total - neto };
}

export const urlPdf = (id: number) => `/documentos-tributarios/${id}/pdf`;

export function presentarDocumento(d: DocumentoTributario, ordenCodigo?: string) {
  return {
    id: d.id,
    tipoDte: d.tipoDte,
    tipoNombre: NOMBRE_DTE[d.tipoDte],
    folio: d.folio,
    ordenId: d.ordenId,
    ordenCodigo,
    ordenEnvioId: d.ordenEnvioId,
    emisorRut: d.emisorRut,
    receptorRut: d.receptorRut,
    neto: d.neto,
    iva: d.iva,
    total: d.total,
    estadoSii: d.estadoSii,
    trackIdSii: d.trackIdSii,
    simulado: true,
    emitidoEn: d.emitidoEn,
    pdfUrl: urlPdf(d.id)
  };
}

/** Documentos que faltan por emitir segun el contexto bloqueado (idempotente). */
export function documentosFaltantes(ctx: ContextoEmision, emisorPlataforma: string): NuevoDocumento[] {
  const nuevos: NuevoDocumento[] = [];
  const { orden } = ctx;
  if (!ctx.documentos.some((d) => d.tipoDte === 33 || d.tipoDte === 39)) {
    const factura = orden.requiereFactura;
    nuevos.push({
      tipoDte: factura ? 33 : 39,
      ordenId: orden.id,
      ordenEnvioId: null,
      emisorRut: emisorPlataforma,
      receptorRut: factura ? ctx.organizacionRut : ctx.clienteRut,
      ...desglosarIva(orden.total),
      total: orden.total
    });
  }
  // Una guia por envio no cancelado; la emite el proveedor del envio.
  for (const e of ctx.envios) {
    if (e.envio.estado === "cancelado") continue;
    if (ctx.documentos.some((d) => d.tipoDte === 52 && d.ordenEnvioId === e.envio.id)) continue;
    const total = e.envio.subtotal + (e.envio.costoDespacho ?? 0);
    nuevos.push({
      tipoDte: 52,
      ordenId: orden.id,
      ordenEnvioId: e.envio.id,
      emisorRut: e.proveedorRut,
      receptorRut: ctx.organizacionRut,
      ...desglosarIva(total),
      total
    });
  }
  return nuevos;
}

/**
 * Caso de uso reutilizable (lo invocara KAN-148 al confirmar un pago): emite la boleta (39) o factura (33)
 * de la orden y una guia de despacho (52) por envio. Idempotente: no duplica lo ya emitido. La orden debe
 * estar pagada (estado_pago = 'pagado'); si no, 409 ORDEN_NO_PAGADA. Devuelve TODOS los documentos de la orden.
 */
export function emitirDocumentosOrden(deps: DepsEmision) {
  return async (ordenId: number, usuarioId: number | null = null) => {
    const emisor = deps.emisorRut ?? EMISOR_RUT_POR_DEFECTO;
    const previo = await deps.documentoRepository.contextoOrden(ordenId);
    if (!previo) throw new ErrorAplicacion(404, "ORDEN_NO_ENCONTRADA", "Orden no encontrada");
    const emitidos = await deps.documentoRepository.emitirParaOrden(ordenId, async (ctx) => {
      if (ctx.orden.estadoPago !== "pagado") {
        throw new ErrorAplicacion(409, "ORDEN_NO_PAGADA", "La orden no esta pagada: no se pueden emitir documentos");
      }
      return {
        documentos: documentosFaltantes(ctx, emisor),
        auditoria: (docs) =>
          docs.map((d) => ({
            usuarioId,
            entidad: "documento_tributario",
            entidadId: d.id,
            accion: "crear" as const,
            datosAntes: null,
            datosDespues: {
              operacion: "emitir_documento",
              tipoDte: d.tipoDte,
              folio: d.folio,
              ordenId: d.ordenId,
              ordenEnvioId: d.ordenEnvioId,
              total: d.total,
              simulado: true
            }
          }))
      };
    });
    const ctx = (await deps.documentoRepository.contextoOrden(ordenId)) as NonNullable<typeof previo>;
    return {
      ordenId,
      ordenCodigo: ctx.orden.codigo,
      nuevos: emitidos.length,
      documentos: ctx.documentos.map((d) => presentarDocumento(d, ctx.orden.codigo))
    };
  };
}

export function listarDocumentos(deps: DepsConsulta) {
  return async (usuarioId: number, input: unknown) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    const alcance = resolverAlcance(ctx);
    const f = validar(listarDocumentosQuerySchema, input);
    const { items, total } = await deps.documentoRepository.listar({
      alcance,
      ordenId: f.ordenId,
      tipo: f.tipo as TipoDte | undefined,
      pagina: f.pagina,
      tamano: f.tamano
    });
    return {
      items: items.map((d) => presentarDocumento(d, d.ordenCodigo)),
      pagina: f.pagina,
      tamano: f.tamano,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / f.tamano))
    };
  };
}

/** PDF del documento. Admin: todos; cliente: los de sus ordenes; proveedor: solo guias de sus envios (el resto = 404). */
export function descargarPdfDocumento(deps: DepsConsulta) {
  return async (usuarioId: number, id: number) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    const alcance = resolverAlcance(ctx);
    const d = await deps.documentoRepository.buscarDetalle(id);
    const permitido =
      !!d &&
      (alcance.tipo === "todas" ||
        (alcance.tipo === "cliente" && d.ordenUsuarioId === alcance.usuarioId) ||
        (alcance.tipo === "proveedor" && d.documento.tipoDte === 52 && d.proveedorId === alcance.proveedorId));
    if (!d || !permitido) throw new ErrorAplicacion(404, "DOCUMENTO_NO_ENCONTRADO", "Documento no encontrado");
    return {
      nombre: `${NOMBRE_DTE[d.documento.tipoDte].toLowerCase().replace(/ /g, "-")}-${d.documento.folio}.pdf`,
      contenido: generarPdfDocumento(d)
    };
  };
}
