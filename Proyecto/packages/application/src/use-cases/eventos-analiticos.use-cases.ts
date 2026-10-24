import {
  MAX_DIAS_RANGO_ESTADISTICAS,
  estadisticasQuerySchema,
  eventoEntradaSchema,
  eventoLoteSchema,
  type EventoAnaliticoRepository,
  type EventoEntradaDto,
  type NuevoEventoAnalitico,
  type RangoFechas
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

const DIA_MS = 86_400_000;

export interface IngestaDeps {
  eventoRepository: EventoAnaliticoRepository;
  /** Se invoca si la escritura falla (el cliente igual recibe exito). */
  alFallar?: (error: unknown) => void;
}

function aNuevo(d: EventoEntradaDto, usuarioId: number | null): NuevoEventoAnalitico {
  return {
    tipoEvento: d.tipo_evento,
    sesionId: d.sesion_id,
    usuarioId,
    productoId: "producto_id" in d ? d.producto_id : null,
    ofertaId: d.tipo_evento === "click_oferta" ? d.oferta_id : null,
    comunaId: d.comuna_id ?? null,
    origen: d.tipo_evento === "vista_producto" ? (d.origen ?? null) : null,
    convirtio: d.tipo_evento === "click_oferta" ? (d.convirtio ?? null) : null,
    termino: d.tipo_evento === "busqueda" ? d.termino : null,
    resultados: d.tipo_evento === "busqueda" ? (d.resultados ?? null) : null
  };
}

async function guardar(deps: IngestaDeps, eventos: NuevoEventoAnalitico[]) {
  try {
    await deps.eventoRepository.registrar(eventos);
  } catch (error) {
    deps.alFallar?.(error); // nunca rompe la experiencia del cliente
  }
}

/** Valida (400 si es invalido) y registra un evento. Un fallo de escritura se registra y se ignora. */
export function registrarEvento(deps: IngestaDeps) {
  return async (input: unknown, usuarioId: number | null = null): Promise<void> => {
    const dto = validar(eventoEntradaSchema, input);
    await guardar(deps, [aNuevo(dto, usuarioId)]);
  };
}

/** Lote de 1 a 20 eventos: la validacion es todo o nada. Devuelve cuantos se aceptaron. */
export function registrarEventosLote(deps: IngestaDeps) {
  return async (input: unknown, usuarioId: number | null = null): Promise<number> => {
    const { eventos } = validar(eventoLoteSchema, input);
    await guardar(deps, eventos.map((d) => aNuevo(d, usuarioId)));
    return eventos.length;
  };
}

// ---------------- Estadisticas ----------------

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Resuelve ?desde&hasta (inclusivos, UTC). Por defecto, los ultimos 30 dias. Maximo 366 dias. */
export function resolverRango(query: unknown, ahora: Date = new Date()): { desde: string; hasta: string; rango: RangoFechas; dias: string[] } {
  const q = validar(estadisticasQuerySchema, query);
  const hasta = q.hasta ?? (q.desde && q.desde > iso(ahora) ? q.desde : iso(ahora));
  const desde = q.desde ?? iso(new Date(new Date(`${hasta}T00:00:00.000Z`).getTime() - 29 * DIA_MS));
  const ini = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  const nDias = Math.round((fin - ini) / DIA_MS) + 1;
  if (nDias > MAX_DIAS_RANGO_ESTADISTICAS) {
    throw new ErrorAplicacion(400, "VALIDACION", `El rango maximo es de ${MAX_DIAS_RANGO_ESTADISTICAS} dias`);
  }
  const dias = Array.from({ length: nDias }, (_, i) => iso(new Date(ini + i * DIA_MS)));
  return { desde, hasta, rango: { desde: new Date(ini), hastaExclusivo: new Date(fin + DIA_MS) }, dias };
}

const conversion = (vistas: number, clicks: number) => (vistas > 0 ? Math.round((clicks / vistas) * 10_000) / 10_000 : 0);

export interface EstadisticasDeps {
  eventoRepository: EventoAnaliticoRepository;
  ahora?: () => Date;
}

const TOP = 10;

export function estadisticasPlataforma(deps: EstadisticasDeps) {
  return async (query: unknown) => {
    const { desde, hasta, rango, dias } = resolverRango(query, deps.ahora?.());
    const [conteos, productos, terminos] = await Promise.all([
      deps.eventoRepository.conteoPorDia(rango),
      deps.eventoRepository.topProductosVistos(rango, TOP),
      deps.eventoRepository.topTerminos(rango, TOP)
    ]);
    const porDia = new Map(dias.map((fecha) => [fecha, { fecha, vistas: 0, clicks: 0, busquedas: 0 }]));
    for (const c of conteos) {
      const f = porDia.get(c.fecha);
      if (!f) continue;
      if (c.tipo === "vista_producto") f.vistas += c.total;
      else if (c.tipo === "click_oferta") f.clicks += c.total;
      else f.busquedas += c.total;
    }
    const serie = [...porDia.values()];
    const totales = serie.reduce(
      (a, f) => ({ vistas: a.vistas + f.vistas, clicks: a.clicks + f.clicks, busquedas: a.busquedas + f.busquedas }),
      { vistas: 0, clicks: 0, busquedas: 0 }
    );
    return {
      desde,
      hasta,
      totales,
      conversionVistaClick: conversion(totales.vistas, totales.clicks),
      porDia: serie,
      productosMasVistos: productos,
      terminosMasBuscados: terminos
    };
  };
}

type DiaVC = Map<string, { fecha: string; vistas: number; clicks: number }>;

/** Solo eventos de las ofertas (y su producto) del proveedor `proveedorId` (organizacion del token). */
export function estadisticasProveedor(deps: EstadisticasDeps) {
  return async (query: unknown, proveedorId: number) => {
    if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
      throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
    }
    const { desde, hasta, rango, dias } = resolverRango(query, deps.ahora?.());
    const conteos = await deps.eventoRepository.conteoPorOfertaDia(rango, proveedorId);
    const vacioDias = (): DiaVC => new Map(dias.map((fecha) => [fecha, { fecha, vistas: 0, clicks: 0 }]));
    const total = vacioDias();
    const ofertas = new Map<number, { ofertaId: number; productoId: number; producto: string; dias: DiaVC }>();
    for (const c of conteos) {
      if (!total.has(c.fecha)) continue;
      const o = ofertas.get(c.ofertaId) ?? { ofertaId: c.ofertaId, productoId: c.productoId, producto: c.producto, dias: vacioDias() };
      ofertas.set(c.ofertaId, o);
      for (const m of [total, o.dias]) {
        const f = m.get(c.fecha)!;
        if (c.tipo === "vista_producto") f.vistas += c.total;
        else f.clicks += c.total;
      }
    }
    const suma = (m: DiaVC) => [...m.values()].reduce((a, f) => ({ vistas: a.vistas + f.vistas, clicks: a.clicks + f.clicks }), { vistas: 0, clicks: 0 });
    const t = suma(total);
    return {
      desde,
      hasta,
      totales: t,
      conversionVistaClick: conversion(t.vistas, t.clicks),
      porDia: [...total.values()],
      porOferta: [...ofertas.values()]
        .map((o) => {
          const s = suma(o.dias);
          return { ofertaId: o.ofertaId, productoId: o.productoId, producto: o.producto, ...s, conversionVistaClick: conversion(s.vistas, s.clicks), porDia: [...o.dias.values()] };
        })
        .sort((a, b) => b.vistas - a.vistas || a.ofertaId - b.ofertaId)
    };
  };
}
