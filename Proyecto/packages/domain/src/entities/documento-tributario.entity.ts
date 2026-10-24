export type DteEstadoSii = "pendiente" | "enviado" | "aceptado" | "rechazado";
// 33 factura, 39 boleta, 52 guia de despacho, 61 nota de credito.
export type TipoDte = 33 | 39 | 52 | 61;

// Ver DataBase/dbDiagram.sql -> Table documento_tributario.
export interface DocumentoTributario {
  id: number;
  tipoDte: TipoDte;
  folio: number;
  ordenId: number | null;
  ordenEnvioId: number | null;
  emisorRut: string;
  receptorRut: string | null;
  neto: number | null;
  iva: number | null;
  total: number;
  trackIdSii: string | null;
  estadoSii: DteEstadoSii;
  xmlUrl: string | null;
  pdfUrl: string | null;
  emitidoEn: Date;
}
