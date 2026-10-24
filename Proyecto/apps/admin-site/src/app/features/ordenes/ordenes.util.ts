import { EnvioEstado, EnvioOrden, MedioPago, OrdenEstado } from "../../core/models/ordenes.models";

const fmtCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export const ETIQUETA_ESTADO_ORDEN: Record<OrdenEstado, string> = {
  pendiente_pago: "Pendiente de pago",
  pagada: "Pagada",
  en_preparacion: "En preparación",
  despachada: "Despachada",
  entregada: "Entregada",
  reembolsada: "Reembolsada"
};
export const ETIQUETA_ESTADO_ENVIO: Record<EnvioEstado, string> = {
  por_despachar: "Por despachar",
  en_preparacion: "En preparación",
  listo_retiro: "Listo para retiro",
  despachado: "Despachado",
  entregado: "Entregado",
  cancelado: "Cancelado"
};
export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  linea_credito: "Línea de crédito"
};

/** CLP sin decimales; "—" si no hay valor (p. ej. montos ocultos). */
export function formatoClp(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? "—" : fmtCLP.format(v);
}

export function medioPagoEtiqueta(m: MedioPago | null | undefined): string {
  return m ? ETIQUETA_MEDIO_PAGO[m] : "—";
}

/** Plazo prometido en horas -> texto legible ("48 h", "2 días", "2 días 6 h"). */
export function formatoPlazo(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return "—";
  if (horas < 24) return `${horas} h`;
  const d = Math.floor(horas / 24);
  const h = horas % 24;
  return `${d} ${d === 1 ? "día" : "días"}${h ? ` ${h} h` : ""}`;
}

/** Comision efectiva de un envio: (subtotal - comision) no aplica; se muestra el porcentaje con coma local. */
export function formatoPct(p: string | null | undefined): string {
  if (p === null || p === undefined || p === "") return "—";
  const n = Number(p);
  return Number.isNaN(n) ? "—" : `${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })} %`;
}

/** Totales de liquidacion de una lista de envios (excluye cancelados). */
export function totalesEnvios(envios: EnvioOrden[]): { comision: number; aLiquidar: number } {
  const act = envios.filter((e) => e.estado !== "cancelado");
  return {
    comision: act.reduce((t, e) => t + (e.comisionMonto ?? 0), 0),
    aLiquidar: act.reduce((t, e) => t + (e.montoALiquidar ?? 0), 0)
  };
}

export function mensajeErrorOrdenes(e: any): string {
  const status = e?.status;
  const msg = e?.error?.error?.message as string | undefined;
  if (status === 403) return "No tienes permiso para ver las órdenes.";
  if (status === 404) return "La orden no existe.";
  if (status === 0) return "No hay conexión con el servidor.";
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
