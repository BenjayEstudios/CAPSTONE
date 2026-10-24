import { ProblemaCatalogo, SemanaDashboard } from "../../core/models/dashboard.models";

export { formatoClp } from "../ordenes/ordenes.util";

export const ETIQUETA_PROBLEMA: Record<ProblemaCatalogo, string> = {
  sin_imagen: "Sin imagen",
  sin_ofertas: "Sin ofertas",
  duplicada: "Posible duplicada"
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-03" -> "marzo 2026". */
export function etiquetaMes(mes: string): string {
  const [a, m] = mes.split("-");
  const nombre = MESES[Number(m) - 1];
  return nombre ? `${nombre} ${a}` : mes;
}

/** "2026-03-09" -> "9 mar". */
export function etiquetaDia(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${Number(d)} ${(MESES[Number(m) - 1] ?? "").slice(0, 3)}`;
}

export function etiquetaSemana(s: SemanaDashboard): string {
  return s.inicio === s.fin ? etiquetaDia(s.inicio) : `${etiquetaDia(s.inicio)} – ${etiquetaDia(s.fin)}`;
}

/** Texto de variacion: "+12,5 %" / "-3 %" / "Sin dato previo". */
export function textoVariacion(v: number | null): string {
  if (v === null) return "Sin dato previo";
  const n = Math.abs(v).toLocaleString("es-CL", { maximumFractionDigits: 1 });
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${n} %`;
}
export function claseVariacion(v: number | null): "sube" | "baja" | "igual" {
  return v === null || v === 0 ? "igual" : v > 0 ? "sube" : "baja";
}

/** "Redondea hacia arriba" un maximo a un valor de escala legible (1, 2, 2.5, 5, 10 x 10^n). */
export function maximoEscala(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return paso * exp;
}

export interface BarraGrafico {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  etiqueta: string;
  monto: number;
}
export interface GeometriaGrafico {
  ancho: number;
  alto: number;
  base: number; // y del eje X
  maximo: number;
  ticks: Array<{ valor: number; y: number }>;
  barras: BarraGrafico[];
}

/** Calcula barras y ticks del grafico en un viewBox fijo (puro, sin DOM). */
export function geometriaGrafico(semanas: SemanaDashboard[], ancho = 640, alto = 280): GeometriaGrafico {
  const m = { izq: 78, der: 12, sup: 16, inf: 44 };
  const base = alto - m.inf;
  const util = base - m.sup;
  const maximo = maximoEscala(Math.max(0, ...semanas.map((s) => s.monto)));
  const ticks = [0, 1, 2, 3, 4].map((i) => ({ valor: (maximo * i) / 4, y: base - (util * i) / 4 }));
  const slot = semanas.length ? (ancho - m.izq - m.der) / semanas.length : 0;
  const barras = semanas.map((s, i) => {
    const h = (s.monto / maximo) * util;
    const a = slot * 0.6;
    return { x: m.izq + slot * i + (slot - a) / 2, y: base - h, ancho: a, alto: h, etiqueta: etiquetaSemana(s), monto: s.monto };
  });
  return { ancho, alto, base, maximo, ticks, barras };
}

/** Valor del <input type="month"> para el mes actual (hora local del navegador). */
export function mesLocalActual(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function mensajeErrorDashboard(e: any): string {
  const msg = e?.error?.error?.message as string | undefined;
  if (e?.status === 403) return "No tienes permiso para ver el dashboard.";
  if (e?.status === 0) return "No hay conexión con el servidor.";
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
