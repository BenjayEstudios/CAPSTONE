import { describe, expect, it } from "vitest";
import type { ConteoOfertaDia, EventoAnaliticoRepository, NuevoEventoAnalitico } from "@cotizapp/domain";
import { estadisticasPlataforma, estadisticasProveedor, registrarEvento, registrarEventosLote } from "./eventos-analiticos.use-cases.js";

function repo(opts: { falla?: boolean; ofertas?: Array<ConteoOfertaDia & { proveedorId: number }> } = {}) {
  const guardados: NuevoEventoAnalitico[] = [];
  const r: EventoAnaliticoRepository = {
    registrar: async (e) => {
      if (opts.falla) throw new Error("db caida");
      guardados.push(...e);
    },
    conteoPorDia: async () => [
      { fecha: "2026-03-01", tipo: "vista_producto", total: 10 },
      { fecha: "2026-03-01", tipo: "click_oferta", total: 2 },
      { fecha: "2026-03-02", tipo: "busqueda", total: 5 },
      { fecha: "2026-03-09", tipo: "vista_producto", total: 99 } // fuera del rango
    ],
    topProductosVistos: async () => [{ productoId: 1, nombre: "Harina", vistas: 10 }],
    topTerminos: async () => [{ termino: "harina", busquedas: 5 }],
    conteoPorOfertaDia: async (_r, proveedorId) =>
      (opts.ofertas ?? []).filter((o) => o.proveedorId === proveedorId).map(({ proveedorId: _p, ...o }) => o)
  };
  return { r, guardados };
}
const ses = "qa-tmp-sesion-1";
const AHORA = () => new Date("2026-03-03T12:00:00Z");

describe("registrarEvento", () => {
  it("guarda vista, click y busqueda normalizando y asociando usuario", async () => {
    const { r, guardados } = repo();
    const reg = registrarEvento({ eventoRepository: r });
    await reg({ tipo_evento: "vista_producto", sesion_id: ses, producto_id: 3, origen: "catalogo" }, 7);
    await reg({ tipo_evento: "click_oferta", sesion_id: ses, producto_id: 3, oferta_id: 5, convirtio: true });
    await reg({ tipo_evento: "busqueda", sesion_id: ses, termino: "  Harina   TRIGO ", resultados: 4 });
    expect(guardados[0]).toMatchObject({ tipoEvento: "vista_producto", usuarioId: 7, productoId: 3, origen: "catalogo", ofertaId: null });
    expect(guardados[1]).toMatchObject({ ofertaId: 5, convirtio: true, usuarioId: null });
    expect(guardados[2]).toMatchObject({ termino: "harina trigo", resultados: 4, productoId: null });
  });
  it("rechaza invalidos: campos extra, tipo, largo, faltantes", async () => {
    const { r } = repo();
    const reg = registrarEvento({ eventoRepository: r });
    const malos: unknown[] = [
      { tipo_evento: "vista_producto", sesion_id: ses, producto_id: 1, ip: "1.1.1.1" },
      { tipo_evento: "otro", sesion_id: ses },
      { tipo_evento: "busqueda", sesion_id: ses, termino: "x".repeat(161) },
      { tipo_evento: "busqueda", sesion_id: ses, termino: "   " },
      { tipo_evento: "click_oferta", sesion_id: ses, producto_id: 1 },
      { tipo_evento: "vista_producto", sesion_id: "corto", producto_id: 1 },
      { tipo_evento: "vista_producto", sesion_id: ses, producto_id: "1" },
      null
    ];
    for (const m of malos) await expect(reg(m)).rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
  });
  it("un fallo de escritura no propaga y se informa", async () => {
    const errores: unknown[] = [];
    const { r } = repo({ falla: true });
    await expect(
      registrarEvento({ eventoRepository: r, alFallar: (e) => errores.push(e) })({ tipo_evento: "vista_producto", sesion_id: ses, producto_id: 1 })
    ).resolves.toBeUndefined();
    expect(errores).toHaveLength(1);
  });
});

describe("registrarEventosLote", () => {
  const ev = { tipo_evento: "vista_producto", sesion_id: ses, producto_id: 1 };
  it("acepta hasta 20, rechaza 0, 21 o un evento invalido (todo o nada)", async () => {
    const { r, guardados } = repo();
    const lote = registrarEventosLote({ eventoRepository: r });
    expect(await lote({ eventos: Array(20).fill(ev) }, 2)).toBe(20);
    expect(guardados).toHaveLength(20);
    for (const m of [{ eventos: [] }, { eventos: Array(21).fill(ev) }, { eventos: [ev, { ...ev, producto_id: -1 }] }, { eventos: [ev], x: 1 }]) {
      await expect(lote(m)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(guardados).toHaveLength(20);
  });
});

describe("estadisticasPlataforma", () => {
  it("agrega por dia (rellena ceros), ignora fuera de rango y calcula conversion", async () => {
    const { r } = repo();
    const res = await estadisticasPlataforma({ eventoRepository: r, ahora: AHORA })({ desde: "2026-03-01", hasta: "2026-03-03" });
    expect(res.porDia).toEqual([
      { fecha: "2026-03-01", vistas: 10, clicks: 2, busquedas: 0 },
      { fecha: "2026-03-02", vistas: 0, clicks: 0, busquedas: 5 },
      { fecha: "2026-03-03", vistas: 0, clicks: 0, busquedas: 0 }
    ]);
    expect(res.totales).toEqual({ vistas: 10, clicks: 2, busquedas: 5 });
    expect(res.conversionVistaClick).toBe(0.2);
    expect(res.productosMasVistos[0]).toEqual({ productoId: 1, nombre: "Harina", vistas: 10 });
  });
  it("por defecto usa 30 dias hasta hoy", async () => {
    const { r } = repo();
    const res = await estadisticasPlataforma({ eventoRepository: r, ahora: AHORA })({});
    expect(res.hasta).toBe("2026-03-03");
    expect(res.porDia).toHaveLength(30);
  });
  it("valida rango: invalido, invertido y mayor a 366 dias; 366 es valido", async () => {
    const { r } = repo();
    const f = estadisticasPlataforma({ eventoRepository: r, ahora: AHORA });
    for (const q of [{ desde: "2026-13-01" }, { hasta: "ayer" }, { desde: "2026-03-05", hasta: "2026-03-01" }, { desde: "2025-01-01", hasta: "2026-03-01" }]) {
      await expect(f(q)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect((await f({ desde: "2025-03-03", hasta: "2026-03-03" })).porDia).toHaveLength(366);
    await expect(f({ desde: "2025-03-02", hasta: "2026-03-03" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("estadisticasProveedor", () => {
  const ofertas = [
    { proveedorId: 10, ofertaId: 1, productoId: 3, producto: "Harina", fecha: "2026-03-01", tipo: "vista_producto" as const, total: 8 },
    { proveedorId: 10, ofertaId: 1, productoId: 3, producto: "Harina", fecha: "2026-03-01", tipo: "click_oferta" as const, total: 2 },
    { proveedorId: 10, ofertaId: 2, productoId: 4, producto: "Azucar", fecha: "2026-03-02", tipo: "vista_producto" as const, total: 12 },
    { proveedorId: 20, ofertaId: 9, productoId: 3, producto: "Harina", fecha: "2026-03-01", tipo: "vista_producto" as const, total: 500 }
  ];
  it("solo agrega lo del proveedor, por oferta y dia", async () => {
    const { r } = repo({ ofertas });
    const res = await estadisticasProveedor({ eventoRepository: r, ahora: AHORA })({ desde: "2026-03-01", hasta: "2026-03-02" }, 10);
    expect(res.totales).toEqual({ vistas: 20, clicks: 2 });
    expect(res.porOferta.map((o) => o.ofertaId)).toEqual([2, 1]);
    expect(res.porOferta[1]).toMatchObject({ vistas: 8, clicks: 2, conversionVistaClick: 0.25 });
    expect(JSON.stringify(res)).not.toMatch(/sesion|usuario/i);
    const otro = await estadisticasProveedor({ eventoRepository: r, ahora: AHORA })({ desde: "2026-03-01", hasta: "2026-03-02" }, 20);
    expect(otro.totales.vistas).toBe(500);
  });
  it("sin organizacion -> 403", async () => {
    const { r } = repo();
    await expect(estadisticasProveedor({ eventoRepository: r })({}, NaN)).rejects.toMatchObject({ statusCode: 403 });
  });
});
