import { describe, expect, it } from "vitest";
import type { CalculoLiquidacion, Liquidacion, LiquidacionRepository, OrdenEnvio, RangoLiquidacion } from "@cotizapp/domain";
import {
  calcularLiquidacion,
  fechaChile,
  generarLiquidaciones,
  inicioDiaChile,
  listarLiquidaciones,
  obtenerLiquidacion,
  pagarLiquidacion,
  semanaAnterior
} from "./liquidaciones.use-cases.js";

const falla = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as { statusCode: number; code: string });

const envio = (id: number, proveedorId: number, cierre: string, extra: Partial<OrdenEnvio> = {}): OrdenEnvio => ({
  id, ordenId: 100 + id, proveedorId, modalidad: "despacho", puntoRetiroId: null, direccionEntregaId: null, plazoHoras: null,
  costoDespacho: 1000, subtotal: 10000, comisionPct: "10.00", comisionMonto: 1000, estado: "entregado", liquidacionId: null,
  montoBrutoLiquidado: null, comisionLiquidada: null, montoNetoLiquidado: null, actualizadoEn: new Date(cierre), ...extra
});

function repoMem(envios: OrdenEnvio[]) {
  const liquidaciones: Liquidacion[] = [];
  const auditoria: unknown[] = [];
  const repo: LiquidacionRepository = {
    async proveedoresConPendientes(r: RangoLiquidacion) {
      return [...new Set(envios.filter((e) => e.estado === "entregado" && e.liquidacionId === null && e.actualizadoEn >= r.desde && e.actualizadoEn < r.hasta).map((e) => e.proveedorId))].sort();
    },
    async liquidarProveedor(proveedorId, r, calcular: (e: OrdenEnvio[]) => CalculoLiquidacion, actorId) {
      const sel = envios.filter((e) => e.proveedorId === proveedorId && e.estado === "entregado" && e.liquidacionId === null && e.actualizadoEn >= r.desde && e.actualizadoEn < r.hasta);
      if (!sel.length) return null;
      const c = calcular(sel);
      const l: Liquidacion = { id: liquidaciones.length + 1, proveedorId, periodoDesde: r.periodoDesde, periodoHasta: r.periodoHasta, montoBruto: c.montoBruto, comision: c.comision, montoNeto: c.montoNeto, estado: "pendiente", pagadaEn: null };
      liquidaciones.push(l);
      for (const x of c.envios) Object.assign(envios.find((e) => e.id === x.envioId)!, { liquidacionId: l.id, montoBrutoLiquidado: x.montoBruto, comisionLiquidada: x.comision, montoNetoLiquidado: x.montoNeto });
      auditoria.push({ actorId, id: l.id });
      return l;
    },
    async listar(f) {
      const items = liquidaciones.filter((l) => (f.proveedorId === undefined || l.proveedorId === f.proveedorId) && (!f.estado || l.estado === f.estado)).map((l) => ({ ...l, proveedorNombre: `P${l.proveedorId}` }));
      return { items, total: items.length };
    },
    async buscarPorId(id) {
      const l = liquidaciones.find((x) => x.id === id);
      return l ? { liquidacion: { ...l, proveedorNombre: "P" }, envios: [] } : null;
    },
    async marcarPagada(id, fecha) {
      const l = liquidaciones.find((x) => x.id === id);
      if (!l) return { resultado: "no_existe" };
      if (l.estado === "pagada") return { resultado: "ya_pagada" };
      l.estado = "pagada";
      l.pagadaEn = fecha;
      return { resultado: "ok", liquidacion: l };
    }
  };
  return { repo, liquidaciones, auditoria };
}

// Semana 2026-10-12 (lunes) a 2026-10-18 (domingo). Chile en octubre: UTC-3 desde el 4-oct (verano).
const PERIODO = { desde: "2026-10-12", hasta: "2026-10-18" };

describe("fechas America/Santiago", () => {
  it("semana anterior: de lunes a domingo, desde cualquier dia de la semana", () => {
    expect(semanaAnterior(new Date("2026-10-20T15:00:00Z"))).toEqual(PERIODO); // martes
    expect(semanaAnterior(new Date("2026-10-19T04:00:00Z"))).toEqual(PERIODO); // lunes 01:00 Chile
    expect(semanaAnterior(new Date("2026-10-19T02:00:00Z"))).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" }); // domingo 23:00 Chile
  });
  it("inicio de dia con horario de verano", () => {
    expect(inicioDiaChile("2026-10-12").toISOString()).toBe("2026-10-12T03:00:00.000Z"); // UTC-3
    expect(inicioDiaChile("2026-06-10").toISOString()).toBe("2026-06-10T04:00:00.000Z"); // UTC-4
    expect(fechaChile(new Date("2026-10-13T02:30:00Z"))).toBe("2026-10-12");
  });
});

describe("calcularLiquidacion", () => {
  it("bruto = subtotal + despacho; comision nula = 0; neto = bruto - comision", () => {
    const c = calcularLiquidacion([envio(1, 1, "2026-10-14T12:00:00Z"), envio(2, 1, "2026-10-14T12:00:00Z", { comisionMonto: null as never, costoDespacho: null, subtotal: 5000 })]);
    expect(c.envios[0]).toMatchObject({ montoBruto: 11000, comision: 1000, montoNeto: 10000 });
    expect(c.envios[1]).toMatchObject({ montoBruto: 5000, comision: 0, montoNeto: 5000 });
    expect(c).toMatchObject({ montoBruto: 16000, comision: 1000, montoNeto: 15000 });
  });
});

describe("generarLiquidaciones", () => {
  const base = () => [
    envio(1, 1, "2026-10-14T12:00:00Z"),
    envio(2, 1, "2026-10-15T12:00:00Z"),
    envio(3, 2, "2026-10-16T12:00:00Z", { comisionMonto: 0 }),
    envio(4, 2, "2026-10-14T12:00:00Z", { estado: "despachado" })
  ];
  it("agrupa por proveedor, llena montos liquidados y audita", async () => {
    const { repo, liquidaciones, auditoria } = repoMem(base());
    const r = await generarLiquidaciones({ liquidacionRepository: repo })(PERIODO, 7);
    expect(r.creadas).toBe(2);
    expect(liquidaciones.map((l) => [l.proveedorId, l.montoBruto, l.comision, l.montoNeto])).toEqual([[1, 22000, 2000, 20000], [2, 11000, 0, 11000]]);
    expect(r).toMatchObject({ montoBruto: 33000, comision: 2000, montoNeto: 31000, zonaHoraria: "America/Santiago" });
    expect(auditoria).toHaveLength(2);
  });
  it("semana limite: lunes 00:00 Chile entra, el lunes siguiente 00:00 no", async () => {
    const envios = [
      envio(1, 1, "2026-10-12T03:00:00Z"), // lunes 00:00 Chile: entra
      envio(2, 1, "2026-10-19T02:59:59Z"), // domingo 23:59:59 Chile: entra
      envio(3, 1, "2026-10-12T02:59:59Z"), // domingo anterior: no
      envio(4, 1, "2026-10-19T03:00:00Z") // lunes siguiente: no
    ];
    const { repo } = repoMem(envios);
    await generarLiquidaciones({ liquidacionRepository: repo })(PERIODO, null);
    expect(envios.map((e) => e.liquidacionId !== null)).toEqual([true, true, false, false]);
  });
  it("idempotente: re-ejecutar el mismo periodo no duplica", async () => {
    const { repo, liquidaciones } = repoMem(base());
    const g = generarLiquidaciones({ liquidacionRepository: repo });
    await g(PERIODO, 7);
    const r2 = await g(PERIODO, 7);
    expect(r2.creadas).toBe(0);
    expect(liquidaciones).toHaveLength(2);
  });
  it("sin desde usa la semana anterior; valida rango", async () => {
    const { repo } = repoMem(base());
    const g = generarLiquidaciones({ liquidacionRepository: repo, ahora: () => new Date("2026-10-20T15:00:00Z") });
    expect((await g({}, null)).periodoDesde).toBe("2026-10-12");
    expect((await falla(g({ desde: "2026-10-18", hasta: "2026-10-12" }, null)))?.statusCode).toBe(400);
    expect((await falla(g({ hasta: "2026-10-12" }, null)))?.statusCode).toBe(400);
    expect((await falla(g({ desde: "2026-13-40" }, null)))?.statusCode).toBe(400);
    expect((await falla(g({ desde: "2026-01-01", hasta: "2026-12-31" }, null)))?.statusCode).toBe(400);
  });
});

describe("pagar y consultar", () => {
  it("paga una vez; el segundo pago es 409; inexistente 404; fecha invalida 400", async () => {
    const { repo } = repoMem([envio(1, 1, "2026-10-14T12:00:00Z")]);
    await generarLiquidaciones({ liquidacionRepository: repo })(PERIODO, 7);
    const pagar = pagarLiquidacion({ liquidacionRepository: repo });
    const l = await pagar(1, { fechaPago: "2026-10-20" }, 7);
    expect(l.estado).toBe("pagada");
    expect(l.pagadaEn?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect((await falla(pagar(1, { fechaPago: "2026-10-21" }, 7)))?.statusCode).toBe(409);
    expect((await falla(pagar(99, { fechaPago: "2026-10-21" }, 7)))?.statusCode).toBe(404);
    expect((await falla(pagar(1, { fechaPago: "ayer" }, 7)))?.statusCode).toBe(400);
  });
  it("listar pagina y filtra; obtener 404", async () => {
    const { repo } = repoMem([envio(1, 1, "2026-10-14T12:00:00Z"), envio(2, 2, "2026-10-14T12:00:00Z")]);
    await generarLiquidaciones({ liquidacionRepository: repo })(PERIODO, 7);
    const r = await listarLiquidaciones({ liquidacionRepository: repo })({ proveedorId: "2" });
    expect(r).toMatchObject({ total: 1, pagina: 1, totalPaginas: 1 });
    expect((await falla(obtenerLiquidacion({ liquidacionRepository: repo })(99)))?.code).toBe("LIQUIDACION_NO_ENCONTRADA");
  });
});
