// Ver DataBase/dbDiagram.sql -> Table orden_linea (valores congelados al comprar).
export interface OrdenLinea {
  id: number;
  ordenEnvioId: number;
  ofertaId: number;
  productoId: number;
  nombreProducto: string;
  formato: string | null;
  precioUnitario: number;
  cantidad: number;
  totalLinea: number;
}
