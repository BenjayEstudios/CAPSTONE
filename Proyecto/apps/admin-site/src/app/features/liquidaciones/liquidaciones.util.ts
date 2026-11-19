import { EstadoLiquidacion } from "../../core/models/liquidaciones.models";

export const ETIQUETA_ESTADO: Record<EstadoLiquidacion, string> = { pendiente: "Pendiente", pagada: "Pagada" };

const fmtCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export function clp(valor: number | null | undefined): string {
  return valor === null || valor === undefined || Number.isNaN(valor) ? "—" : fmtCLP.format(valor);
}

/** "2026-10-12" -> "12-10-2026" (sin pasar por Date: evita corrimientos de zona horaria). */
export function fechaCorta(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function hoyYmd(ahora: Date = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${m}-${d}`;
}

function sumar(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Semana anterior (lunes a domingo) respecto de `ahora`; sugerencia por defecto del formulario de generacion. */
export function semanaAnteriorYmd(ahora: Date = new Date()): { desde: string; hasta: string } {
  const hoy = hoyYmd(ahora);
  const dow = new Date(`${hoy}T00:00:00Z`).getUTCDay();
  const lunes = sumar(hoy, -((dow + 6) % 7));
  return { desde: sumar(lunes, -7), hasta: sumar(lunes, -1) };
}

/** Valida el rango del formulario de generacion; null si es valido. */
export function validarRango(desde: string, hasta: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return "Indica la fecha de inicio.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return "Indica la fecha de término.";
  if (hasta < desde) return "La fecha de término no puede ser anterior al inicio.";
  const dias = (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / 86_400_000;
  return dias > 30 ? "El rango no puede superar 31 días." : null;
}

export function validarFechaPago(fecha: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? null : "Elige la fecha de pago.";
}

export function mensajeErrorLiquidaciones(e: { status?: number; error?: { error?: { code?: string; message?: string } } }): string {
  const code = e?.error?.error?.code;
  if (code === "LIQUIDACION_YA_PAGADA") return "La liquidación ya estaba pagada. Se actualizó la información.";
  if (e?.status === 403) return "No tienes permiso para esta acción.";
  if (e?.status === 404) return "La liquidación no existe.";
  return e?.error?.error?.message ?? "No se pudo completar la operación. Intenta de nuevo.";
}
