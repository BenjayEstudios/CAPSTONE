import { dashboardQuerySchema, type DashboardRepository, type MontoDia, type ProductoSalud, type RangoMes } from "@cotizapp/domain";
import { validar } from "../validacion.js";

// KAN-113. Definiciones (documentadas en apps/backend/README.md):
// - Orden contada: estado_pago = 'pagado' y estado <> 'reembolsada' (pendientes, fallidas y reembolsadas no cuentan).
//   Se asigna al mes por creada_en. "Monto transado" = suma de orden.total de ordenes contadas.
// - Comision = suma de comision_monto de envios no cancelados de ordenes contadas.
// - Proveedores activos = proveedores en estado 'activa' con al menos un envio no cancelado en el mes.
// - Las fechas de BD se agrupan por calendario tal cual estan almacenadas; el "mes actual" se resuelve en America/Santiago.

export const TOP_PROVEEDORES = 10;
export const MAX_DETALLE_SALUD = 20;
const ZONA = "America/Santiago";
const DIA_MS = 86_400_000;

export interface Kpi {
  valor: number;
  anterior: number;
  /** Variacion % vs mes anterior (1 decimal); null si el mes anterior fue 0. */
  variacionPct: number | null;
}
export interface Semana {
  inicio: string;
  fin: string;
  monto: number;
}
export type ProblemaCatalogo = "sin_imagen" | "sin_ofertas" | "duplicada";

export function mesActual(ahora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit" }).formatToParts(ahora);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function rangoDeMes(mes: string): RangoMes {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return { desde: new Date(Date.UTC(a, m - 1, 1)), hastaExclusivo: new Date(Date.UTC(a, m, 1)) };
}
export function mesAnteriorDe(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function variacionPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/** Semanas (lunes a domingo) del mes, recortadas a sus limites; incluye semanas sin ventas (monto 0). */
export function semanasDelMes(r: RangoMes, porDia: MontoDia[]): Semana[] {
  const montos = new Map(porDia.map((d) => [d.fecha, d.monto]));
  const semanas: Semana[] = [];
  let actual: Semana | null = null;
  for (let t = r.desde.getTime(); t < r.hastaExclusivo.getTime(); t += DIA_MS) {
    const f = iso(t);
    if (!actual || new Date(t).getUTCDay() === 1) {
      actual = { inicio: f, fin: f, monto: 0 };
      semanas.push(actual);
    }
    actual.fin = f;
    actual.monto += montos.get(f) ?? 0;
  }
  return semanas;
}

const normalizar = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Duplicada = mismo EAN no nulo, o mismo nombre normalizado + formato normalizado. Devuelve las fichas involucradas (sin repetir). */
export function detectarDuplicadas(productos: ProductoSalud[]): ProductoSalud[] {
  const claves = new Map<string, ProductoSalud[]>();
  const agregar = (k: string, p: ProductoSalud) => claves.set(k, [...(claves.get(k) ?? []), p]);
  for (const p of productos) {
    if (p.ean && p.ean.trim()) agregar(`ean:${p.ean.trim()}`, p);
    const nombre = normalizar(p.nombre);
    if (nombre) agregar(`nom:${nombre}|${normalizar(p.formato)}`, p);
  }
  const ids = new Set<number>();
  for (const g of claves.values()) if (g.length > 1) g.forEach((p) => ids.add(p.id));
  return productos.filter((p) => ids.has(p.id));
}

const kpi = (valor: number, anterior: number): Kpi => ({ valor, anterior, variacionPct: variacionPct(valor, anterior) });

export interface DashboardDeps {
  dashboardRepository: DashboardRepository;
  ahora?: () => Date;
}

export function resumenDashboard(deps: DashboardDeps) {
  const repo = deps.dashboardRepository;
  return async (query: unknown) => {
    const { mes: pedido } = validar(dashboardQuerySchema, query);
    const mes = pedido ?? mesActual(deps.ahora?.());
    const mesAnterior = mesAnteriorDe(mes);
    const rango = rangoDeMes(mes);

    const [actual, previo, porDia, proveedores, sinImg, sinOf, candidatos] = await Promise.all([
      repo.totalesMes(rango),
      repo.totalesMes(rangoDeMes(mesAnterior)),
      repo.montoPorDia(rango),
      repo.proveedoresPorVolumen(rango, TOP_PROVEEDORES),
      repo.productosSinImagen(MAX_DETALLE_SALUD),
      repo.productosSinOfertas(MAX_DETALLE_SALUD),
      repo.productosParaDuplicados()
    ]);
    const dup = detectarDuplicadas(candidatos);

    // Detalle: intercala los problemas para que ninguno quede fuera, hasta 20 en total.
    const listas: Array<{ problema: ProblemaCatalogo; items: ProductoSalud[] }> = [
      { problema: "sin_imagen", items: sinImg.items },
      { problema: "sin_ofertas", items: sinOf.items },
      { problema: "duplicada", items: dup }
    ];
    const detalle: Array<{ productoId: number; producto: string; problema: ProblemaCatalogo }> = [];
    for (let i = 0; detalle.length < MAX_DETALLE_SALUD && listas.some((l) => i < l.items.length); i++) {
      for (const l of listas) {
        const p = l.items[i];
        if (p && detalle.length < MAX_DETALLE_SALUD) detalle.push({ productoId: p.id, producto: p.nombre, problema: l.problema });
      }
    }

    return {
      mes,
      mesAnterior,
      kpis: {
        ordenes: kpi(actual.ordenes, previo.ordenes),
        montoTransado: kpi(actual.monto, previo.monto),
        comision: kpi(actual.comision, previo.comision),
        proveedoresActivos: kpi(actual.proveedoresActivos, previo.proveedoresActivos)
      },
      semanas: semanasDelMes(rango, porDia),
      proveedoresPorVolumen: proveedores,
      saludCatalogo: { sinImagen: sinImg.total, sinOfertas: sinOf.total, duplicadas: dup.length, detalle }
    };
  };
}
