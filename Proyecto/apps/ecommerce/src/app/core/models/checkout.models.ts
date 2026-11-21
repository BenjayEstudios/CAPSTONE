// Formas del API para el checkout (apps/mobile/API_CONTRACT.md, KAN-95).

export interface DireccionGuardada {
  id: number;
  calle: string;
  numero: string | null;
  complemento: string | null;
  referencia: string | null;
  comunaId: number;
  comuna: string;
  region: string;
  /** KAN-109: para saber que distribuidores cubren la direccion. */
  regionCodigo?: string;
}

export interface PuntoRetiro {
  id: number;
  proveedorId: number;
  nombre: string;
  horario: string | null;
  direccion: string;
}

/** Zona de despacho de un distribuidor (KAN-109): una comuna o toda la region (comunaId null). */
export interface CoberturaDespacho {
  proveedorId: number;
  comunaId: number | null;
  regionCodigo: string;
  costoDespacho: number;
  plazoHoras: number | null;
}

/** GET /carro/opciones-entrega */
export interface OpcionesEntrega {
  direcciones: DireccionGuardada[];
  puntosRetiro: PuntoRetiro[];
  /** KAN-109: sin este campo (API anterior) se asume cobertura y decide el backend. */
  coberturas?: CoberturaDespacho[];
}

/** GET /comunas */
export interface Comuna {
  id: number;
  nombre: string;
  regionCodigo: string;
  regionNombre: string;
}

export interface DireccionNueva {
  comunaId: number;
  calle: string;
  numero?: string;
  complemento?: string;
  referencia?: string;
}

/** POST /carro/confirmar */
export interface ConfirmarCarroRequest {
  direccionId?: number;
  direccion?: DireccionNueva;
  retiros: Array<{ proveedorId: number; puntoRetiroId: number }>;
  requiereFactura: boolean;
}

export interface OrdenCreada {
  ordenId: number;
  codigo: string;
  estado: "pendiente_pago";
  subtotal: number;
  costoDespachoTotal: number;
  total: number;
}

export type MedioPago = "tarjeta" | "transferencia" | "linea_credito";

/** POST /ordenes/:id/pago */
export interface PagoIniciado {
  ordenId: number;
  codigo: string;
  total: number;
  pasarela: string;
  urlPago: string;
  token: string;
  /** "POST": formulario con token_ws (Webpay). "GET": redireccion a urlPago (PayPal). Ausente = POST. */
  metodo?: "POST" | "GET";
}

export interface EnvioOrden {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  modalidad: "despacho" | "retiro";
  plazoHoras: number | null;
  costoDespacho: number;
  subtotal: number;
  estado: string;
  lineas?: Array<{ ofertaId: number; nombreProducto: string; formato: string | null; precioUnitario: number; cantidad: number; totalLinea: number }>;
  /** Solo en el detalle: el punto de retiro si la modalidad es retiro (KAN-96). */
  puntoRetiro?: { id: number; nombre: string; horario: string | null; direccion: string } | null;
  /** Solo en el detalle del cliente: su calificacion del envio, si ya califico (KAN-99). */
  calificacion?: CalificacionEnvio | null;
}

export interface CalificacionEnvio {
  puntaje: number;
  comentario: string | null;
  creadaEn: string;
}

export interface DireccionEntrega {
  calle: string;
  numero: string | null;
  complemento: string | null;
  referencia: string | null;
  comunaNombre: string;
  regionNombre: string;
}

/** GET /documentos-tributarios?ordenId= (DTE simulados, KAN-153). */
export interface DocumentoTributario {
  id: number;
  tipoDte: 33 | 39 | 52 | 61;
  tipoNombre: string;
  folio: number;
  ordenId: number;
  ordenEnvioId: number | null;
  total: number;
  emitidoEn: string;
  pdfUrl: string;
}

/** GET /ordenes/:id (vista del cliente) */
export interface OrdenDetalle {
  id: number;
  codigo: string;
  estado: "pendiente_pago" | "pagada" | "en_preparacion" | "despachada" | "entregada" | "reembolsada";
  estadoPago: "autorizado" | "pagado" | "fallido" | "reembolsado";
  medioPago: MedioPago | null;
  creadaEn: string;
  pagadoEn: string | null;
  requiereFactura: boolean;
  subtotal: number;
  costoDespachoTotal: number;
  total: number;
  /** Solo en el detalle. */
  direccionEntrega?: DireccionEntrega | null;
  envios: EnvioOrden[];
}

/** Lo que vuelve en ?pago= desde el retorno de la pasarela (Webpay o PayPal). */
export type ResultadoPago = "aprobado" | "rechazado" | "anulado" | "error";
