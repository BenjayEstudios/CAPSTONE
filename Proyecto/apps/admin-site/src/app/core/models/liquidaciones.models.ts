export type EstadoLiquidacion = "pendiente" | "pagada";

export interface Liquidacion {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  periodoDesde: string; // YYYY-MM-DD
  periodoHasta: string;
  montoBruto: number;
  comision: number;
  montoNeto: number;
  estado: EstadoLiquidacion;
  pagadaEn: string | null;
}

export interface EnvioLiquidado {
  envioId: number;
  ordenId: number;
  ordenCodigo: string;
  entregadoEn: string;
  montoBruto: number;
  comision: number;
  montoNeto: number;
}

export interface LiquidacionDetalle extends Liquidacion {
  envios: EnvioLiquidado[];
}

export interface LiquidacionesRespuesta {
  items: Liquidacion[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosLiquidaciones {
  proveedorId?: number | "";
  estado?: EstadoLiquidacion | "";
  desde?: string;
  hasta?: string;
  pagina?: number;
  tamano?: number;
}

export interface ResultadoGeneracion {
  periodoDesde: string;
  periodoHasta: string;
  zonaHoraria: string;
  creadas: number;
  montoBruto: number;
  comision: number;
  montoNeto: number;
  liquidaciones: Liquidacion[];
  errores: Array<{ proveedorId: number; mensaje: string }>;
}
