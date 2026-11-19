export interface ReembolsoItem {
  id: number;
  folio: number;
  monto: number;
  motivo: string | null;
  usuarioId: number | null;
  creadoEn: string;
  pdfUrl: string;
}

export interface ResumenReembolsos {
  orden: {
    id: number;
    codigo: string;
    estado: string;
    estadoPago: string;
    total: number;
    pagadoEn: string | null;
    cliente: string;
    organizacion: string;
  };
  reembolsado: number;
  saldo: number;
  reembolsable: boolean;
  items: ReembolsoItem[];
}

export interface CrearReembolsoBody {
  monto?: number;
  motivo: string;
}

export interface ReembolsoCreado extends ResumenReembolsos {
  notaCredito: { id: number; folio: number; total: number; pdfUrl: string };
  devolucionPasarela: "no_integrada" | "ok" | "error";
}
