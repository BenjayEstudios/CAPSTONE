import { describe, expect, it } from "vitest";
import type { AnaliticaRepository, PendientesProveedor, ProveedorDocumento, ProveedorRepository } from "@cotizapp/domain";
import { alertasProveedor, proximoMartes, ventasProveedor, vigenciaDocumento } from "./panel-proveedor.use-cases.js";

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
