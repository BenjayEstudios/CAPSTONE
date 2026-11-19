export type LiquidacionEstado = "pendiente" | "pagada";

// Ver DataBase/dbDiagram.sql -> Table liquidacion.
export interface Liquidacion {
  id: number;
  proveedorId: number;
  periodoDesde: string; // YYYY-MM-DD
  periodoHasta: string; // YYYY-MM-DD
  montoBruto: number;
  comision: number;
  montoNeto: number;
  estado: LiquidacionEstado;
  pagadaEn: Date | null;
}
