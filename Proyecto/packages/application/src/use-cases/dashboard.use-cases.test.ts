import { describe, expect, it } from "vitest";
import type { DashboardRepository, ProductoSalud } from "@cotizapp/domain";
import { detectarDuplicadas, mesActual, mesAnteriorDe, rangoDeMes, resumenDashboard, semanasDelMes, variacionPct } from "./dashboard.use-cases.js";

const p = (id: number, nombre: string, ean: string | null = null, formato: string | null = "1 kg"): ProductoSalud => ({ id, nombre, ean, formato });

function repo(extra: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    async totalesMes(r) {
      return r.desde.getUTCMonth() === 2 ? { ordenes: 3, monto: 150000, comision: 15000, proveedoresActivos: 2 } : { ordenes: 2, monto: 100000, comision: 0, proveedoresActivos: 0 };
    },
    async montoPorDia() { return [{ fecha: "2026-03-02", monto: 100000 }, { fecha: "2026-03-31", monto: 50000 }]; },
    async proveedoresPorVolumen() { return [{ proveedorId: 1, nombre: "P", skus: 2, ordenes: 3, monto: 140000 }]; },
    async productosSinImagen() { return { total: 1, items: [p(10, "A")] }; },
    async productosSinOfertas() { return { total: 0, items: [] }; },
    async productosParaDuplicados() { return [p(1, "Harina", "123"), p(2, "Otra", "123"), p(3, "Azucar"), p(4, " azúcar ")]; },
    ...extra
  };
}

describe("fechas", () => {
  it("mes actual en Santiago respeta el huso", () => {
    expect(mesActual(new Date("2026-04-01T02:00:00Z"))).toBe("2026-03");
    expect(mesActual(new Date("2026-04-01T12:00:00Z"))).toBe("2026-04");
  });
  it("mes anterior cruza el anio", () => {
    expect(mesAnteriorDe("2026-01")).toBe("2025-12");
    expect(mesAnteriorDe("2026-03")).toBe("2026-02");
  });
  it("variacion: null con base 0, 1 decimal", () => {
    expect(variacionPct(5, 0)).toBeNull();
    expect(variacionPct(150, 100)).toBe(50);
    expect(variacionPct(0, 100)).toBe(-100);
    expect(variacionPct(101, 300)).toBe(-66.3);
  });
});

describe("semanasDelMes", () => {
  it("marzo 2026 (empieza domingo): semanas recortadas lunes-domingo", () => {
    const s = semanasDelMes(rangoDeMes("2026-03"), [{ fecha: "2026-03-01", monto: 5 }, { fecha: "2026-03-02", monto: 7 }, { fecha: "2026-03-31", monto: 9 }]);
    expect(s.map((x) => [x.inicio, x.fin])).toEqual([
      ["2026-03-01", "2026-03-01"], ["2026-03-02", "2026-03-08"], ["2026-03-09", "2026-03-15"],
      ["2026-03-16", "2026-03-22"], ["2026-03-23", "2026-03-29"], ["2026-03-30", "2026-03-31"]
    ]);
    expect(s.map((x) => x.monto)).toEqual([5, 7, 0, 0, 0, 9]);
  });
  it("febrero 2027 (lunes a domingo exactos) -> 4 semanas", () => {
    expect(semanasDelMes(rangoDeMes("2027-02"), [])).toHaveLength(4);
  });
});

describe("detectarDuplicadas", () => {
  it("por EAN y por nombre+formato normalizado; EAN nulo no agrupa", () => {
    expect(detectarDuplicadas([p(1, "Harina", "123"), p(2, "Otra", "123"), p(3, "Azucar"), p(4, " azúcar "), p(5, "X"), p(6, "Y")]).map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });
  it("mismo nombre con distinto formato no es duplicada", () => {
    expect(detectarDuplicadas([p(1, "Harina", null, "1 kg"), p(2, "Harina", null, "25 kg")])).toEqual([]);
  });
});

describe("resumenDashboard", () => {
  it("compara contra el mes anterior y arma la salud del catalogo", async () => {
    const res = await resumenDashboard({ dashboardRepository: repo() })({ mes: "2026-03" });
    expect(res.mesAnterior).toBe("2026-02");
    expect(res.kpis.ordenes).toEqual({ valor: 3, anterior: 2, variacionPct: 50 });
    expect(res.kpis.comision.variacionPct).toBeNull();
    expect(res.saludCatalogo).toMatchObject({ sinImagen: 1, sinOfertas: 0, duplicadas: 4 });
    expect(res.saludCatalogo.detalle[0]).toEqual({ productoId: 10, producto: "A", problema: "sin_imagen" });
    expect(res.proveedoresPorVolumen).toHaveLength(1);
  });
  it("usa el mes actual por defecto y limita el detalle a 20", async () => {
    const muchos = Array.from({ length: 30 }, (_, i) => p(100 + i, `N${i}`));
    const res = await resumenDashboard({
      dashboardRepository: repo({ productosSinImagen: async () => ({ total: 30, items: muchos }) }),
      ahora: () => new Date("2026-06-15T12:00:00Z")
    })({});
    expect(res.mes).toBe("2026-06");
    expect(res.saludCatalogo.detalle).toHaveLength(20);
  });
  it("todo cero sin errores y mes invalido -> 400", async () => {
    const vacio = repo({
      totalesMes: async () => ({ ordenes: 0, monto: 0, comision: 0, proveedoresActivos: 0 }),
      montoPorDia: async () => [],
      proveedoresPorVolumen: async () => [],
      productosParaDuplicados: async () => [],
      productosSinImagen: async () => ({ total: 0, items: [] })
    });
    const res = await resumenDashboard({ dashboardRepository: vacio })({ mes: "2026-02" });
    expect(res.kpis.montoTransado.valor).toBe(0);
    expect(res.semanas.every((s) => s.monto === 0)).toBe(true);
    await expect(resumenDashboard({ dashboardRepository: vacio })({ mes: "2026-1" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
