export type OrdenEstado = "pendiente_pago" | "pagada" | "en_preparacion" | "despachada" | "entregada" | "reembolsada";
export type EnvioEstado = "por_despachar" | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado";
export type MedioPago = "tarjeta" | "transferencia" | "linea_credito";

export interface LineaOrden {
  id: number;
  nombreProducto: string;
  formato: string | null;
  precioUnitario: number;
  cantidad: number;
  totalLinea: number;
}

export interface EnvioOrden {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  modalidad: "despacho" | "retiro";
  plazoHoras: number | null;
  costoDespacho: number | null;
  subtotal: number;
  comisionPct: string | null;
  comisionMonto: number | null;
  montoEnvio: number;
  montoALiquidar: number | null;
  estado: EnvioEstado;
  lineas?: LineaOrden[];
}

export interface OrdenResumen {
  id: number;
  codigo: string;
  estado: OrdenEstado;
  estadoPago: string;
  creadaEn: string;
  medioPago: MedioPago | null;
  comuna: string | null;
  cliente?: { nombre: string; organizacion: string };
  subtotal: number;
  costoDespachoTotal: number;
  comisionTotal: number | null;
  montoALiquidarTotal: number | null;
  total: number;
  envios: EnvioOrden[];
}

export interface OrdenDetalle extends OrdenResumen {
  direccionEntrega?: { calle: string; numero: string | null; comunaNombre: string; regionNombre: string } | null;
}

export interface OrdenesRespuesta {
  items: OrdenResumen[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosOrdenes {
  estado?: string;
  pagina?: number;
  tamano?: number;
}
