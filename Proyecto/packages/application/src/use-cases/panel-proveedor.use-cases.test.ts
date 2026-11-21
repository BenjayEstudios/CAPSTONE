import { describe, expect, it } from "vitest";
import type { AnaliticaRepository, PendientesProveedor, ProveedorDocumento, ProveedorRepository } from "@cotizapp/domain";
import {
  alertasProveedor,
  conversionClicks,
  demandaProveedor,
  porcentajeRestante,
  proximoMartes,
  ventasProveedor,
  vigenciaDocumento
} from "./panel-proveedor.use-cases.js";

const ahora = () => new Date("2026-11-20T15:00:00Z");
const semana = (s: string, ventas: number, envios = 1) => ({ semana: s, envios, ventas, despacho: 1000, comision: 100, neto: ventas + 900 });

describe("ventasProveedor (KAN-101)", () => {
  it("expone semanas y productos del rango y suma los totales", async () => {
    const llamadas: unknown[] = [];
    const analiticaRepository = {
      ventasPorSemana: async (id: number, r: unknown) => (llamadas.push(["semana", id, r]), [semana("2026-11-02", 5000), semana("2026-11-09", 0, 0), semana("2026-11-16", 3000, 2)]),
      ventasPorProducto: async (id: number, _r: unknown, limite: number) => (llamadas.push(["producto", id, limite]), [{ productoId: 1, nombre: "Aceite", unidades: 3, ventas: 8000 }])
    } as unknown as AnaliticaRepository;
    const r = await ventasProveedor({ analiticaRepository, ahora })({ desde: "2026-11-01", hasta: "2026-11-20" }, 2);
    expect(r.desde).toBe("2026-11-01");
    expect(r.hasta).toBe("2026-11-20");
    expect(r.totales).toEqual({ envios: 3, ventas: 8000, despacho: 3000, comision: 300, neto: 10700 });
    expect(r.semanas).toHaveLength(3);
    expect(r.productos[0]!.nombre).toBe("Aceite");
    // El rango llega como [desde, hasta + 1 dia).
    expect(llamadas[0]).toEqual(["semana", 2, { desde: new Date("2026-11-01T00:00:00Z"), hasta: new Date("2026-11-21T00:00:00Z") }]);
    expect(llamadas[1]).toEqual(["producto", 2, 10]);
  });

  it("sin organizacion proveedora: 403", async () => {
    await expect(ventasProveedor({ analiticaRepository: {} as AnaliticaRepository })({}, Number.NaN)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("alertasProveedor (KAN-101)", () => {
  const doc = (tipo: ProveedorDocumento["tipo"], venceEn: string | null, revisionEstado: ProveedorDocumento["revisionEstado"] = "aprobado") =>
    ({ id: 1, proveedorId: 2, tipo, url: "", venceEn, vigencia: "al_dia", revisionEstado, motivoRechazo: null, revisadoPor: null, revisadoEn: null }) as ProveedorDocumento;
  const pendientes: PendientesProveedor = {
    stockBajo: [{ ofertaId: 17, productoId: 9, producto: "Leche entera", cajasDisponibles: 4, cajasIniciales: 39 }],
    entregadoSinLiquidar: 10000, liquidacionesPendientes: 97367, enviosPorDespachar: 2, ofertasPublicadas: 13, ofertasBorrador: 1
  };

  it("documentos con su vigencia de hoy y los que faltan; stock, cobro, envios y ofertas", async () => {
    const umbrales: number[] = [];
    const r = await alertasProveedor({
      analiticaRepository: { pendientesProveedor: async (_id: number, u: number) => (umbrales.push(u), pendientes) } as unknown as AnaliticaRepository,
      proveedorRepository: { listarDocumentos: async () => [doc("carpeta_tributaria", "2026-11-17"), doc("resolucion_sanitaria", "2026-12-20")] } as unknown as ProveedorRepository,
      ahora
    })(2);
    expect(umbrales).toEqual([20]);
    expect(r.documentos).toEqual([
      { tipo: "carpeta_tributaria", venceEn: "2026-11-17", revision: "aprobado", estado: "vencido", diasParaVencer: -3 },
      { tipo: "resolucion_sanitaria", venceEn: "2026-12-20", revision: "aprobado", estado: "por_vencer", diasParaVencer: 30 },
      { tipo: "vigencia", venceEn: null, revision: null, estado: "falta", diasParaVencer: null }
    ]);
    expect(r.stockBajo).toEqual(pendientes.stockBajo);
    expect(r.porCobrar).toEqual({ entregadoSinLiquidar: 10000, liquidacionesPendientes: 97367, total: 107367, proximaLiquidacion: "2026-11-24" });
    expect(r.enviosPorDespachar).toBe(2);
    expect(r.ofertas).toEqual({ publicadas: 13, borradores: 1 });
  });

  it("vigencia: vencido, por vencer hasta 45 dias, al dia; proximo martes incluye el mismo martes", () => {
    expect(vigenciaDocumento("2027-01-04", "2026-11-20")).toEqual({ estado: "por_vencer", diasParaVencer: 45 });
    expect(vigenciaDocumento("2027-01-05", "2026-11-20")).toEqual({ estado: "al_dia", diasParaVencer: 46 });
    expect(vigenciaDocumento(null, "2026-11-20")).toEqual({ estado: "al_dia", diasParaVencer: null });
    expect(proximoMartes("2026-11-24")).toBe("2026-11-24");
    expect(proximoMartes("2026-11-25")).toBe("2026-12-01");
  });
});

describe("demandaProveedor (KAN-107)", () => {
  const embudo = (ofertaId: number, nombre: string, vistas: number, clicks: number, cajasVendidas: number, estadoOferta = "publicada") => ({
    ofertaId, productoId: ofertaId + 100, nombre, formato: null, estadoOferta, vistas, clicks, conversiones: 0, cajasVendidas, tasaClick: null, tasaConversion: null
  });
  it("ultimos 30 dias por defecto; ordena por vistas, stock por lo que queda y potenciales por clientes", async () => {
    const llamadas: unknown[] = [];
    const analiticaRepository = {
      embudoPorProducto: async (id: number, r: unknown) => (llamadas.push(["embudo", id, r]), [
        embudo(1, "Arroz", 120, 30, 12),
        embudo(2, "Leche", 300, 60, 40),
        embudo(3, "Borrador sin actividad", 0, 0, 0, "borrador"),
        embudo(4, "Huevos", 4, 5, 0)
      ]),
      stockDelMes: async (id: number, inicio: Date) => (llamadas.push(["stock", id, inicio.toISOString()]), [
        { ofertaId: 1, productoId: 101, nombre: "Arroz", formato: null, cajasDisponibles: 30, cajasInicioMes: 120 },
        { ofertaId: 2, productoId: 102, nombre: "Leche", formato: null, cajasDisponibles: 5, cajasInicioMes: 50 },
        { ofertaId: 4, productoId: 104, nombre: "Huevos", formato: null, cajasDisponibles: 10, cajasInicioMes: null }
      ]),
      potencialesPorComuna: async () => [
        { comunaId: 1, comuna: "Ñuñoa", region: "RM", clientes: 1, cubre: true },
        { comunaId: 2, comuna: "Concepción", region: "Biobío", clientes: 3, cubre: false }
      ]
    } as unknown as AnaliticaRepository;
    const r = await demandaProveedor({ analiticaRepository, ahora: () => new Date("2026-11-20T15:00:00Z") })({}, 2);
    expect(r).toMatchObject({ desde: "2026-10-22", hasta: "2026-11-20", inicioMes: "2026-11-01" });
    expect(llamadas[0]).toEqual(["embudo", 2, { desde: new Date("2026-10-22T00:00:00Z"), hasta: new Date("2026-11-21T00:00:00Z") }]);
    expect(llamadas[1]).toEqual(["stock", 2, "2026-11-01T00:00:00.000Z"]);
    expect(r.productos.map((p) => [p.producto, p.conversion, p.cajasVendidas])).toEqual([["Leche", 20, 40], ["Arroz", 25, 12], ["Huevos", 100, 0]]);
    expect(r.restantes.map((s) => [s.producto, s.porcentaje])).toEqual([["Leche", 10], ["Arroz", 25], ["Huevos", null]]);
    expect(r.potenciales.map((p) => p.comuna)).toEqual(["Concepción", "Ñuñoa"]);
  });
  it("sin organizacion proveedora -> 403", async () => {
    await expect(demandaProveedor({ analiticaRepository: {} as AnaliticaRepository })({}, Number.NaN)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("conversion y porcentaje restante", () => {
    expect(conversionClicks(0, 3)).toBeNull();
    expect(conversionClicks(173, 48)).toBe(27.7);
    expect(conversionClicks(4, 5)).toBe(100);
    expect(porcentajeRestante(0, 39)).toBe(0);
    expect(porcentajeRestante(30, 45)).toBe(67);
    expect(porcentajeRestante(60, 40)).toBe(150);
    expect(porcentajeRestante(5, 0)).toBeNull();
  });
});
