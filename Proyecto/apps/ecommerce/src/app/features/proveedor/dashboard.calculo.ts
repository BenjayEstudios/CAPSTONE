import { VentaSemana, VentasProveedor } from "../../core/proveedor/panel-proveedor.service";

// Fechas y cifras del dashboard del proveedor (KAN-101), puras para poder
// probarlas sin reloj. Fechas en 'AAAA-MM-DD' (UTC, como el backend).

const DIA_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface RangosDashboard {
  /** Del 1 del mes a hoy. */
  mes: { desde: string; hasta: string };
  /** El mismo tramo del mes anterior (del 1 al mismo dia, acotado al largo del mes). */
  mesAnterior: { desde: string; hasta: string };
  /** 12 semanas: desde el lunes de hace 11 semanas hasta hoy. */
  semanas: { desde: string; hasta: string };
}

export function rangosDashboard(hoy: Date): RangosDashboard {
  const a = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth();
  const d = hoy.getUTCDate();
  const ultimoDiaAnterior = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const lunes = new Date(Date.UTC(a, m, d) - ((hoy.getUTCDay() + 6) % 7) * DIA_MS);
  return {
    mes: { desde: iso(new Date(Date.UTC(a, m, 1))), hasta: iso(hoy) },
    mesAnterior: { desde: iso(new Date(Date.UTC(a, m - 1, 1))), hasta: iso(new Date(Date.UTC(a, m - 1, Math.min(d, ultimoDiaAnterior)))) },
    semanas: { desde: iso(new Date(lunes.getTime() - 11 * 7 * DIA_MS)), hasta: iso(hoy) }
  };
}

/** Variacion porcentual redondeada; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/** "+14 % vs. octubre", "−3 % vs. octubre", "sin ventas en octubre". */
export function textoVariacion(actual: number, anterior: number, mesAnterior: string): string {
  const v = variacion(actual, anterior);
  if (v === null) return actual > 0 ? `sin ventas en el mismo tramo de ${mesAnterior}` : `igual que ${mesAnterior}`;
  if (v === 0) return `igual que ${mesAnterior}`;
  return `${v > 0 ? "+" : "−"}${Math.abs(v)} % vs. ${mesAnterior}`;
}

export function ticketPromedio(v: Pick<VentasProveedor, "totales">): number {
  return v.totales.envios ? Math.round(v.totales.ventas / v.totales.envios) : 0;
}

/** Numero de semana ISO del lunes dado ('S47'). */
export function semanaIso(lunes: string): number {
  const d = new Date(`${lunes}T00:00:00Z`);
  const jueves = new Date(d.getTime() + 3 * DIA_MS);
  const enero1 = Date.UTC(jueves.getUTCFullYear(), 0, 1);
  return Math.floor((jueves.getTime() - enero1) / DIA_MS / 7) + 1;
}

/** Ultimas 12 semanas (la serie puede traer una semana parcial al inicio). */
export function ultimas12(semanas: VentaSemana[]): VentaSemana[] {
  return semanas.slice(-12);
}
