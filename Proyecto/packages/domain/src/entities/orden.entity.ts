export type OrdenEstado = "pendiente_pago" | "pagada" | "en_preparacion" | "despachada" | "entregada" | "reembolsada";
export type PagoMedio = "tarjeta" | "transferencia" | "linea_credito";
export type PagoEstado = "autorizado" | "pagado" | "fallido" | "reembolsado";

// Ver DataBase/dbDiagram.sql -> Table orden (incluye el pago fusionado).
export interface Orden {
  id: number;
  codigo: string;
  usuarioId: number;
  organizacionId: number;
  direccionEntregaId: number | null;
  subtotal: number;
  costoDespachoTotal: number;
  comisionTotal: number;
  total: number;
  requiereFactura: boolean;
  estado: OrdenEstado;
  medioPago: PagoMedio | null;
  estadoPago: PagoEstado;
  referenciaPasarela: string | null;
  creadaEn: Date;
  pagadoEn: Date | null;
}
