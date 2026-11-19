export type OrdenEnvioModalidad = "despacho" | "retiro";
export type OrdenEnvioEstado =
  | "por_despachar"
  | "en_preparacion"
  | "listo_retiro"
  | "despachado"
  | "entregado"
  | "cancelado";

// Ver DataBase/dbDiagram.sql -> Table orden_envio (incluye el detalle de liquidacion fusionado).
export interface OrdenEnvio {
  id: number;
  ordenId: number;
  proveedorId: number;
  modalidad: OrdenEnvioModalidad;
  puntoRetiroId: number | null;
  direccionEntregaId: number | null;
  plazoHoras: number | null;
  costoDespacho: number | null;
  subtotal: number;
  comisionPct: string; // decimal(5,2) como string
  comisionMonto: number;
  estado: OrdenEnvioEstado;
  liquidacionId: number | null;
  montoBrutoLiquidado: number | null;
  comisionLiquidada: number | null;
  montoNetoLiquidado: number | null;
  actualizadoEn: Date;
}
