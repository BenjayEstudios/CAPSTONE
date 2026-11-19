import {
  generarLiquidacionesSchema,
  listarLiquidacionesQuerySchema,
  pagarLiquidacionSchema,
  type CalculoLiquidacion,
  type LiquidacionRepository,
  type OrdenEnvio,
  type RangoLiquidacion,
  type UsuarioRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { cumpleRequisito } from "./verificar-permisos.use-case.js";

/** Zona horaria de negocio: las semanas de liquidacion van de lunes 00:00 a domingo 23:59 hora de Chile. */
export const ZONA_LIQUIDACIONES = "America/Santiago";
const MAX_DIAS_RANGO = 31;

// ---- Fechas en America/Santiago (sin librerias) ----
const partes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_LIQUIDACIONES, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
});
function offsetMs(instante: Date): number {
  const p = Object.fromEntries(partes.formatToParts(instante).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(instante.getTime() / 1000) * 1000;
}
/** Fecha calendario (YYYY-MM-DD) de un instante en hora de Chile. */
export function fechaChile(instante: Date): string {
  const p = Object.fromEntries(partes.formatToParts(instante).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
/** Instante en que empieza el dia `ymd` en hora de Chile (maneja horario de verano). */
export function inicioDiaChile(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = Date.UTC(y!, m! - 1, d!);
  let t = base - offsetMs(new Date(base));
  t = base - offsetMs(new Date(t));
  return new Date(t);
}
export function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** Semana anterior completa (lunes a domingo) respecto de `ahora`, en hora de Chile. */
export function semanaAnterior(ahora: Date): { desde: string; hasta: string } {
  const hoy = fechaChile(ahora);
  const dow = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const lunesActual = sumarDias(hoy, -((dow + 6) % 7));
  return { desde: sumarDias(lunesActual, -7), hasta: sumarDias(lunesActual, -1) };
}
export function rangoDe(desde: string, hasta: string): RangoLiquidacion {
  return { periodoDesde: desde, periodoHasta: hasta, desde: inicioDiaChile(desde), hasta: inicioDiaChile(sumarDias(hasta, 1)) };
}

/**
 * Montos de un envio entregado: bruto = subtotal + costo de despacho (lo que cobra el proveedor),
 * comision = comision_monto del envio (NULL/ausente = 0: el negocio aun no define la comision), neto = bruto - comision.
 */
export function calcularLiquidacion(envios: OrdenEnvio[]): CalculoLiquidacion {
  const detalle = envios.map((e) => {
    const montoBruto = e.subtotal + (e.costoDespacho ?? 0);
    const comision = Math.min(montoBruto, e.comisionMonto ?? 0);
    return { envioId: e.id, montoBruto, comision, montoNeto: montoBruto - comision };
  });
  const sum = (k: "montoBruto" | "comision" | "montoNeto") => detalle.reduce((a, x) => a + x[k], 0);
  return { montoBruto: sum("montoBruto"), comision: sum("comision"), montoNeto: sum("montoNeto"), envios: detalle };
}

// ---- Casos de uso ----
interface Deps {
  liquidacionRepository: LiquidacionRepository;
  ahora?: () => Date;
}

/** `actorId` null = ejecutado por el job programado. */
export function generarLiquidaciones(deps: Deps) {
  return async (input: unknown, actorId: number | null) => {
    const dto = validar(generarLiquidacionesSchema, input ?? {});
    let desde: string;
    let hasta: string;
    if (dto.desde) {
      desde = dto.desde;
      hasta = dto.hasta ?? sumarDias(desde, 6);
    } else {
      if (dto.hasta) throw new ErrorAplicacion(400, "VALIDACION", "hasta: requiere desde");
      ({ desde, hasta } = semanaAnterior((deps.ahora ?? (() => new Date()))()));
    }
    if (hasta < desde) throw new ErrorAplicacion(400, "VALIDACION", "hasta: no puede ser anterior a desde");
    if (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime() > (MAX_DIAS_RANGO - 1) * 86_400_000) {
      throw new ErrorAplicacion(400, "VALIDACION", `El rango no puede superar ${MAX_DIAS_RANGO} dias`);
    }
    const rango = rangoDe(desde, hasta);
    const proveedores = await deps.liquidacionRepository.proveedoresConPendientes(rango);
    const liquidaciones = [];
    const errores: Array<{ proveedorId: number; mensaje: string }> = [];
    for (const proveedorId of proveedores) {
      try {
        const l = await deps.liquidacionRepository.liquidarProveedor(proveedorId, rango, calcularLiquidacion, actorId);
        if (l) liquidaciones.push(l);
      } catch (e) {
        errores.push({ proveedorId, mensaje: e instanceof Error ? e.message : "Error desconocido" });
      }
    }
    return {
      periodoDesde: desde,
      periodoHasta: hasta,
      zonaHoraria: ZONA_LIQUIDACIONES,
      creadas: liquidaciones.length,
      montoBruto: liquidaciones.reduce((a, l) => a + l.montoBruto, 0),
      comision: liquidaciones.reduce((a, l) => a + l.comision, 0),
      montoNeto: liquidaciones.reduce((a, l) => a + l.montoNeto, 0),
      liquidaciones,
      errores
    };
  };
}

export function listarLiquidaciones(deps: Deps) {
  return async (input: unknown, forzarProveedorId?: number) => {
    const f = validar(listarLiquidacionesQuerySchema, input);
    const filtros = forzarProveedorId !== undefined ? { ...f, proveedorId: forzarProveedorId } : f;
    const { items, total } = await deps.liquidacionRepository.listar(filtros);
    return { items, pagina: f.pagina, tamano: f.tamano, total, totalPaginas: Math.max(1, Math.ceil(total / f.tamano)) };
  };
}

export function obtenerLiquidacion(deps: Deps) {
  return async (id: number) => {
    const r = await deps.liquidacionRepository.buscarPorId(id);
    if (!r) throw new ErrorAplicacion(404, "LIQUIDACION_NO_ENCONTRADA", "Liquidacion no encontrada");
    return { ...r.liquidacion, envios: r.envios };
  };
}

export function pagarLiquidacion(deps: Deps) {
  return async (id: number, input: unknown, actorId: number) => {
    const { fechaPago } = validar(pagarLiquidacionSchema, input);
    // Mediodia UTC: cae el mismo dia calendario en Chile (UTC-3/-4).
    const r = await deps.liquidacionRepository.marcarPagada(id, new Date(`${fechaPago}T12:00:00Z`), actorId);
    if (r.resultado === "no_existe") throw new ErrorAplicacion(404, "LIQUIDACION_NO_ENCONTRADA", "Liquidacion no encontrada");
    if (r.resultado === "ya_pagada") throw new ErrorAplicacion(409, "LIQUIDACION_YA_PAGADA", "La liquidacion ya esta pagada");
    return r.liquidacion;
  };
}

/** Liquidaciones del proveedor autenticado (permiso ver_ordenes_propias, organizacion tipo proveedor). */
export function listarMisLiquidaciones(deps: Deps & { usuarioRepository: UsuarioRepository }) {
  return async (usuarioId: number, input: unknown) => {
    const ctx = await deps.usuarioRepository.buscarPorId(usuarioId);
    if (!ctx || ctx.usuario.estado !== "activo") throw new ErrorAplicacion(401, "UNAUTHORIZED", "Sesion invalida");
    if (ctx.organizacion.tipo !== "proveedor" || !cumpleRequisito(ctx.rol.permisos, { codigo: "ver_ordenes_propias" })) {
      throw new ErrorAplicacion(403, "FORBIDDEN", "No tienes permiso para esto");
    }
    return listarLiquidaciones(deps)(input, ctx.organizacion.id);
  };
}
