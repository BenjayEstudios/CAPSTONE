import type { DocumentoTributario, TipoDte } from "../entities/documento-tributario.entity.js";
import type { Orden, OrdenEstado, PagoEstado } from "../entities/orden.entity.js";
import type { OrdenEnvio } from "../entities/orden-envio.entity.js";
import type { AlcanceOrdenes } from "./orden.repository.js";
import type { RegistroAuditoria } from "./proveedor.repository.js";

// Documento por emitir: el folio y el estado SII los asigna el repositorio dentro de la transaccion.
export interface NuevoDocumento {
  tipoDte: TipoDte;
  ordenId: number;
  ordenEnvioId: number | null;
  emisorRut: string;
  receptorRut: string | null;
  neto: number;
  iva: number;
  total: number;
}

export interface EnvioParaEmision {
  envio: OrdenEnvio;
  proveedorRut: string;
  proveedorNombre: string;
}

export interface ContextoEmision {
  orden: Orden;
  clienteRut: string | null;
  clienteNombre: string;
  organizacionRut: string;
  organizacionNombre: string;
  envios: EnvioParaEmision[];
  /** Todos los documentos de la orden y de sus envios (incluye notas de credito). */
  documentos: DocumentoTributario[];
}

export interface PlanEmision {
  documentos: NuevoDocumento[];
  auditoria: (emitidos: DocumentoTributario[]) => RegistroAuditoria[];
}

export interface PlanReembolso {
  nota: NuevoDocumento;
  /** undefined = no tocar. */
  estadoPago?: PagoEstado;
  estadoOrden?: OrdenEstado;
  auditoria: (nota: DocumentoTributario) => RegistroAuditoria[];
}

export interface LineaDocumento {
  nombre: string;
  formato: string | null;
  cantidad: number;
  precioUnitario: number;
  totalLinea: number;
}

export interface DocumentoDetalle {
  documento: DocumentoTributario;
  ordenCodigo: string;
  ordenUsuarioId: number;
  /** Proveedor del envio (solo guias). */
  proveedorId: number | null;
  emisorNombre: string;
  receptorNombre: string;
  lineas: LineaDocumento[];
  /** Documento original al que referencia una nota de credito. */
  referencia: DocumentoTributario | null;
  /** Motivo del reembolso (solo notas de credito). */
  motivo: string | null;
}

export interface DocumentoListado extends DocumentoTributario {
  ordenCodigo: string;
}

export interface FiltrosDocumentos {
  alcance: AlcanceOrdenes;
  ordenId?: number;
  tipo?: TipoDte;
  pagina: number;
  tamano: number;
}

export interface ReembolsoRegistro {
  nota: DocumentoTributario;
  motivo: string | null;
  usuarioId: number | null;
  creadoEn: Date;
}

export interface DocumentoTributarioRepository {
  /** Contexto de lectura (sin bloqueo); null si la orden no existe. */
  contextoOrden(ordenId: number): Promise<ContextoEmision | null>;
  /** null si no existe una orden con ese codigo (folio visible). */
  buscarOrdenIdPorCodigo(codigo: string): Promise<number | null>;
  /**
   * Transaccion: bloquea la orden (FOR UPDATE; serializa emisiones de una misma orden), ejecuta `planificar`,
   * asigna folios correlativos por (tipo, emisor) sin huecos ni repeticiones ante concurrencia, inserta los
   * documentos y la auditoria. Devuelve los documentos insertados.
   */
  emitirParaOrden(ordenId: number, planificar: (ctx: ContextoEmision) => Promise<PlanEmision>): Promise<DocumentoTributario[]>;
  /** Igual que emitirParaOrden pero emite UNA nota de credito y actualiza el pago/estado de la orden en la misma transaccion. */
  registrarReembolso(ordenId: number, planificar: (ctx: ContextoEmision) => Promise<PlanReembolso>): Promise<DocumentoTributario>;
  listar(f: FiltrosDocumentos): Promise<{ items: DocumentoListado[]; total: number }>;
  buscarDetalle(id: number): Promise<DocumentoDetalle | null>;
  listarReembolsos(ordenId: number): Promise<ReembolsoRegistro[]>;
}
