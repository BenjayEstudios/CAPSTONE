import {
  TIPOS_DOCUMENTO_REQUERIDOS,
  type AnaliticaRepository,
  type ProveedorDocumentoTipo,
  type ProveedorRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { resolverRango } from "./eventos-analiticos.use-cases.js";

// Panel del proveedor (KAN-101) y lo que la app movil pide en KAN-133/137:
// ventas por semana y producto, y lo que requiere atencion.

/** Oferta con este numero de cajas o menos cuenta como stock bajo (decision abierta 13). */
export const UMBRAL_STOCK_BAJO = 20;
/** Un documento que vence en estos dias o menos esta "por vencer" (decision abierta 13). */
export const DIAS_POR_VENCER = 45;
const TOP_PRODUCTOS = 10;
const DIA_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function exigirProveedor(proveedorId: number) {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
}

/**
 * GET /estadisticas/proveedor/ventas?desde&hasta: venta = envio no cancelado
 * de una orden pagada, fechado por la orden (AnaliticaRepository). Totales,
 * una fila por semana (lunes, con ceros) y los productos mas vendidos.
 */
export function ventasProveedor(deps: { analiticaRepository: AnaliticaRepository; ahora?: () => Date }) {
  return async (query: unknown, proveedorId: number) => {
    exigirProveedor(proveedorId);
    const { desde, hasta, rango } = resolverRango(query, deps.ahora?.());
    const r = { desde: rango.desde, hasta: rango.hastaExclusivo };
    const [semanas, productos] = await Promise.all([
      deps.analiticaRepository.ventasPorSemana(proveedorId, r),
      deps.analiticaRepository.ventasPorProducto(proveedorId, r, TOP_PRODUCTOS)
    ]);
    const totales = semanas.reduce(
      (t, s) => ({ envios: t.envios + s.envios, ventas: t.ventas + s.ventas, despacho: t.despacho + s.despacho, comision: t.comision + s.comision, neto: t.neto + s.neto }),
      { envios: 0, ventas: 0, despacho: 0, comision: 0, neto: 0 }
    );
    return { desde, hasta, totales, semanas, productos };
  };
}

/** Clicks sobre vistas, en porcentaje con un decimal; null sin vistas. */
export function conversionClicks(vistas: number, clicks: number): number | null {
  // Un mismo cliente puede abrir la oferta mas de una vez por vista: se topa en 100.
  return vistas > 0 ? Math.min(100, Math.round((clicks / vistas) * 1000) / 10) : null;
}

/** Stock actual sobre el del inicio del mes, en porcentaje entero; null sin base. */
export function porcentajeRestante(actual: number, inicio: number | null): number | null {
  return inicio && inicio > 0 ? Math.round((actual / inicio) * 100) : null;
}

/**
 * GET /proveedor/demanda?desde&hasta (KAN-107), por defecto los ultimos 30
 * dias: lo mas visto y clickeado de mis ofertas con conversion y cajas
 * vendidas, el stock que queda frente al del inicio del mes, y los clientes
 * que vieron mis productos y se los compraron a otro, por comuna.
 */
export function demandaProveedor(deps: { analiticaRepository: AnaliticaRepository; ahora?: () => Date }) {
  return async (query: unknown, proveedorId: number) => {
    exigirProveedor(proveedorId);
    const { desde, hasta, rango } = resolverRango(query, deps.ahora?.());
    const r = { desde: rango.desde, hasta: rango.hastaExclusivo };
    const inicioMes = new Date(`${iso((deps.ahora ?? (() => new Date()))()).slice(0, 7)}-01T00:00:00.000Z`);
    const [embudo, stock, potenciales] = await Promise.all([
      deps.analiticaRepository.embudoPorProducto(proveedorId, r),
      deps.analiticaRepository.stockDelMes(proveedorId, inicioMes),
      deps.analiticaRepository.potencialesPorComuna(proveedorId, r)
    ]);
    return {
      desde,
      hasta,
      inicioMes: iso(inicioMes),
      productos: embudo
        .filter((e) => e.estadoOferta !== "borrador" || e.vistas + e.clicks + e.cajasVendidas > 0)
        .map((e) => ({
          ofertaId: e.ofertaId,
          productoId: e.productoId,
          producto: e.nombre,
          formato: e.formato,
          vistas: e.vistas,
          clicks: e.clicks,
          conversion: conversionClicks(e.vistas, e.clicks),
          cajasVendidas: e.cajasVendidas
        }))
        .sort((a, b) => b.vistas - a.vistas || b.clicks - a.clicks || a.producto.localeCompare(b.producto, "es")),
      restantes: stock
        .map((s) => ({
          ofertaId: s.ofertaId,
          productoId: s.productoId,
          producto: s.nombre,
          formato: s.formato,
          cajas: s.cajasDisponibles,
          cajasInicioMes: s.cajasInicioMes,
          porcentaje: porcentajeRestante(s.cajasDisponibles, s.cajasInicioMes)
        }))
        .sort((a, b) => (a.porcentaje ?? Infinity) - (b.porcentaje ?? Infinity) || a.producto.localeCompare(b.producto, "es")),
      potenciales: [...potenciales].sort((a, b) => b.clientes - a.clientes || a.comuna.localeCompare(b.comuna, "es"))
    };
  };
}

export type EstadoDocumentoAlerta = "al_dia" | "por_vencer" | "vencido" | "falta";

/** Vigencia del documento calculada hoy (no la columna del seed): vencido, por vencer (<= 45 dias) o al dia. */
export function vigenciaDocumento(venceEn: string | null, hoy: string): { estado: Exclude<EstadoDocumentoAlerta, "falta">; diasParaVencer: number | null } {
  if (!venceEn) return { estado: "al_dia", diasParaVencer: null };
  const dias = Math.round((Date.parse(`${venceEn}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / DIA_MS);
  return { estado: dias < 0 ? "vencido" : dias <= DIAS_POR_VENCER ? "por_vencer" : "al_dia", diasParaVencer: dias };
}

/** Proximo martes (dia de liquidacion semanal), hoy incluido. */
export function proximoMartes(hoy: string): string {
  const d = new Date(`${hoy}T00:00:00Z`);
  const faltan = (2 - d.getUTCDay() + 7) % 7;
  return new Date(d.getTime() + faltan * DIA_MS).toISOString().slice(0, 10);
}

/**
 * GET /alertas/proveedor: documentos (vigencia calculada hoy, y los
 * obligatorios que faltan), ofertas con stock bajo, lo por cobrar y los
 * envios por despachar. `ofertas` (publicadas y borradores) es aditivo.
 */
export function alertasProveedor(deps: { analiticaRepository: AnaliticaRepository; proveedorRepository: ProveedorRepository; ahora?: () => Date }) {
  return async (proveedorId: number) => {
    exigirProveedor(proveedorId);
    const hoy = (deps.ahora?.() ?? new Date()).toISOString().slice(0, 10);
    const [documentos, p] = await Promise.all([
      deps.proveedorRepository.listarDocumentos(proveedorId),
      deps.analiticaRepository.pendientesProveedor(proveedorId, UMBRAL_STOCK_BAJO)
    ]);
    const vistos = new Set<ProveedorDocumentoTipo>(documentos.map((d) => d.tipo));
    return {
      documentos: [
        ...documentos.map((d) => ({ tipo: d.tipo, venceEn: d.venceEn, revision: d.revisionEstado, ...vigenciaDocumento(d.venceEn, hoy) })),
        ...TIPOS_DOCUMENTO_REQUERIDOS.filter((t) => !vistos.has(t)).map((tipo) => ({
          tipo, venceEn: null, revision: null, estado: "falta" as const, diasParaVencer: null
        }))
      ],
      stockBajo: p.stockBajo,
      porCobrar: {
        entregadoSinLiquidar: p.entregadoSinLiquidar,
        liquidacionesPendientes: p.liquidacionesPendientes,
        total: p.entregadoSinLiquidar + p.liquidacionesPendientes,
        proximaLiquidacion: proximoMartes(hoy)
      },
      enviosPorDespachar: p.enviosPorDespachar,
      ofertas: { publicadas: p.ofertasPublicadas, borradores: p.ofertasBorrador }
    };
  };
}

/**
 * GET /proveedor/cobertura: condiciones de entrega del proveedor de la sesion
 * (corte, despacho gratis desde, zonas con su costo). Valen para todas sus
 * ofertas; la pantalla "Asignarme un producto" las muestra (KAN-102) y se
 * editan en "Cobertura de despacho" (KAN-109).
 */
export function miCobertura(deps: { proveedorRepository: ProveedorRepository }) {
  return async (proveedorId: number) => {
    exigirProveedor(proveedorId);
    return deps.proveedorRepository.cobertura(proveedorId);
  };
}
