import { expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { DrizzleAnaliticaRepository } from "../src/repositories/analitica.repository.js";
import { consultar } from "../src/db/client.js";
import { orden } from "../src/db/schema/orden.schema.js";
import { describeDb } from "./db.js";

const LOS_ANDES = 2;
const LAS_PALMAS = 5;
const RANGO = { desde: new Date("2026-09-01T00:00:00Z"), hasta: new Date("2026-11-01T00:00:00Z") };

describeDb("DrizzleAnaliticaRepository", (db) => {
  const repo = () => new DrizzleAnaliticaRepository(db());

  it("ventasPorSemana: una fila por semana del rango, con los montos de las ordenes del seed", async () => {
    const semanas = await repo().ventasPorSemana(LOS_ANDES, RANGO);
    // Calculado a mano desde seedOrdenes: subtotal de los envios de Los
    // Andes por semana (lunes UTC) de orden.creada_en; la del 21-sep no tuvo.
    expect(semanas.map((s) => [s.semana, s.envios, s.ventas, s.despacho])).toEqual([
      ["2026-08-31", 1, 109000, 4990],
      ["2026-09-07", 1, 52650, 0],
      ["2026-09-14", 1, 71340, 4990],
      ["2026-09-21", 0, 0, 0],
      ["2026-09-28", 1, 47300, 4990],
      ["2026-10-05", 1, 84710, 4990],
      ["2026-10-12", 1, 100410, 4990],
      ["2026-10-19", 1, 32950, 0],
      ["2026-10-26", 0, 0, 0]
    ]);
    for (const s of semanas) expect(s.neto).toBe(s.ventas + s.despacho - s.comision);
    expect(semanas.find((s) => s.semana === "2026-10-05")!.comision).toBe(6777);
  });

  it("ventasPorProducto: ranking por monto y suma igual al total de la semana", async () => {
    const productos = await repo().ventasPorProducto(LOS_ANDES, RANGO, 3);
    expect(productos).toEqual([
      { productoId: 1, nombre: "Aceite vegetal maravilla", unidades: 12, ventas: 149880 },
      { productoId: 2, nombre: "Aceite de oliva extra virgen", unidades: 10, ventas: 94900 },
      { productoId: 11, nombre: "Huevos blancos extra", unidades: 11, ventas: 72490 }
    ]);
    const todos = await repo().ventasPorProducto(LOS_ANDES, RANGO, 100);
    const semanas = await repo().ventasPorSemana(LOS_ANDES, RANGO);
    expect(todos.reduce((a, p) => a + p.ventas, 0)).toBe(semanas.reduce((a, s) => a + s.ventas, 0));
    expect(await repo().ventasPorProducto(LAS_PALMAS, RANGO)).toEqual([]);
  });

  it("embudoPorProducto: coincide con contar los eventos directamente", async () => {
    const embudo = await repo().embudoPorProducto(LOS_ANDES, RANGO);
    expect(embudo).toHaveLength(13); // ofertas de Los Andes en el seed

    const aceite = embudo.find((e) => e.productoId === 1)!;
    const [esperado] = await consultar<{ vistas: number; clicks: number; conversiones: string }>(
      db(),
      sql`SELECT
            (SELECT COUNT(*) FROM evento_analitico WHERE tipo_evento = 'vista_producto' AND producto_id = 1) AS vistas,
            (SELECT COUNT(*) FROM evento_analitico e JOIN oferta o ON o.id = e.oferta_id WHERE o.proveedor_id = ${LOS_ANDES} AND o.producto_id = 1) AS clicks,
            (SELECT SUM(e.convirtio) FROM evento_analitico e JOIN oferta o ON o.id = e.oferta_id WHERE o.proveedor_id = ${LOS_ANDES} AND o.producto_id = 1) AS conversiones`
    );
    expect(aceite).toMatchObject({ vistas: esperado!.vistas, clicks: esperado!.clicks, conversiones: Number(esperado!.conversiones) });
    expect(aceite.vistas).toBeGreaterThan(0);
    expect(aceite.tasaClick).toBeCloseTo(aceite.clicks / aceite.vistas, 4);
    for (const e of embudo) expect(e.conversiones).toBeLessThanOrEqual(e.clicks);
  });

  it("kpisPlataforma: totales de las 11 ordenes pagadas y de los eventos del rango", async () => {
    const kpis = await repo().kpisPlataforma(RANGO);
    expect(kpis).toMatchObject({ ordenes: 11, gmv: 1831000, ticketPromedio: Math.round(1831000 / 11), proveedoresConVentas: 3, clientesConCompras: 2 });

    const [esperado] = await consultar<{ comisiones: string; eventos: number; sinResultados: string }>(
      db(),
      sql`SELECT (SELECT SUM(comision_total) FROM orden) AS comisiones,
                 (SELECT COUNT(*) FROM evento_analitico) AS eventos,
                 (SELECT SUM(resultados = 0) FROM evento_analitico WHERE tipo_evento = 'busqueda') AS sinResultados`
    );
    expect(kpis.comisiones).toBe(Number(esperado!.comisiones));
    expect(kpis.vistas + kpis.clicks + kpis.busquedas).toBe(esperado!.eventos);
    expect(kpis.busquedasSinResultados).toBe(Number(esperado!.sinResultados));
    expect(kpis.tasaConversion).toBeCloseTo(kpis.conversiones / kpis.clicks, 4);
  });

  it("los limites del rango se comparan en UTC, igual que como se guardan las fechas", async () => {
    // Si el rango se pasara en hora local, en Chile quedaria corrido 3-4 h y
    // la orden no caeria en su propio minuto.
    const [o1] = await db().select({ creadaEn: orden.creadaEn }).from(orden).where(eq(orden.id, 1));
    const kpis = await repo().kpisPlataforma({ desde: o1!.creadaEn, hasta: new Date(o1!.creadaEn.getTime() + 60 * 1000) });
    expect(kpis.ordenes).toBe(1);
  });

  it("terminosSinResultados: los huecos del catalogo, mas buscados primero", async () => {
    const terminos = await repo().terminosSinResultados(RANGO);
    expect(terminos.map((t) => t.termino).sort()).toEqual(["harina integral", "leche sin lactosa", "levadura", "mantequilla"]);
    const veces = terminos.map((t) => t.veces);
    expect(veces).toEqual([...veces].sort((a, b) => b - a));
  });

  it("las subconsultas del embudo y los terminos usan los indices compuestos y podan particiones", async () => {
    type Plan = { key: string; partitions: string; Extra: string | null };
    const plan = async (q: ReturnType<typeof sql>) => (await consultar<Plan>(db(), sql`EXPLAIN ${q}`))[0]!;
    const quincena = sql`creado_en >= '2026-10-01' AND creado_en < '2026-10-15'`;

    const vistas = await plan(sql`SELECT COUNT(*) FROM evento_analitico WHERE producto_id = 1 AND tipo_evento = 'vista_producto' AND ${quincena}`);
    expect(vistas).toMatchObject({ key: "ix_evento_analitico_producto_id", partitions: "p202610" });
    expect(vistas.Extra).toMatch(/Using index/);

    const conversiones = await plan(sql`SELECT COUNT(*) FROM evento_analitico WHERE oferta_id = 1 AND convirtio = 1 AND ${quincena}`);
    expect(conversiones).toMatchObject({ key: "ix_evento_analitico_oferta_id", partitions: "p202610" });
    expect(conversiones.Extra).toMatch(/Using index/);

    const terminos = await plan(sql`SELECT termino FROM evento_analitico WHERE tipo_evento = 'busqueda' AND resultados = 0 AND ${quincena}`);
    expect(terminos).toMatchObject({ key: "ix_evento_analitico_tipo_evento", partitions: "p202610" });
  });

  it("un rango sin datos devuelve ceros y tasas null", async () => {
    // Lunes a lunes: exactamente una semana.
    const vacio = { desde: new Date("2025-01-06T00:00:00Z"), hasta: new Date("2025-01-13T00:00:00Z") };
    expect(await repo().kpisPlataforma(vacio)).toMatchObject({ ordenes: 0, gmv: 0, ticketPromedio: null, tasaConversion: null });
    expect(await repo().ventasPorSemana(LOS_ANDES, vacio)).toEqual([
      { semana: "2025-01-06", envios: 0, ventas: 0, despacho: 0, comision: 0, neto: 0 }
    ]);
  });
});
