import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const usuarios: Record<number, unknown> = {
  1: { usuario: { id: 1, estado: "activo", organizacionId: 1 }, rol: { permisos: { ver_todas_ordenes: "total" } }, organizacion: { id: 1, tipo: "interna", estado: "activa" } },
  2: { usuario: { id: 2, estado: "activo", organizacionId: 1 }, rol: { permisos: { crear_producto: "total" } }, organizacion: { id: 1, tipo: "interna", estado: "activa" } }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      return usuarios[id] ?? null;
    }
  },
  DrizzleDashboardRepository: class {
    async totalesMes() { return { ordenes: 0, monto: 0, comision: 0, proveedoresActivos: 0 }; }
    async montoPorDia() { return []; }
    async proveedoresPorVolumen() { return []; }
    async productosSinImagen() { return { total: 0, items: [] }; }
    async productosSinOfertas() { return { total: 0, items: [] }; }
    async productosParaDuplicados() { return []; }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { dashboardRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  dashboardRoutes.forEach((r) => app.route(r));
});

describe("GET /dashboard/resumen", () => {
  it("401 sin token y 403 sin ver_todas_ordenes", async () => {
    expect((await app.inject({ method: "GET", url: "/dashboard/resumen" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/dashboard/resumen", headers: bearer("2") })).statusCode).toBe(403);
  });
  it("todo en cero y 6 semanas para marzo 2026", async () => {
    const r = await app.inject({ method: "GET", url: "/dashboard/resumen?mes=2026-03", headers: bearer("1") });
    expect(r.statusCode).toBe(200);
    const b = r.json();
    expect(b.mes).toBe("2026-03");
    expect(b.mesAnterior).toBe("2026-02");
    expect(b.kpis.ordenes).toEqual({ valor: 0, anterior: 0, variacionPct: null });
    expect(b.semanas.length).toBe(6);
    expect(b.saludCatalogo).toEqual({ sinImagen: 0, sinOfertas: 0, duplicadas: 0, detalle: [] });
  });
  it("mes invalido -> 400; sin mes usa el mes actual", async () => {
    expect((await app.inject({ method: "GET", url: "/dashboard/resumen?mes=2026-13", headers: bearer("1") })).statusCode).toBe(400);
    const r = await app.inject({ method: "GET", url: "/dashboard/resumen", headers: bearer("1") });
    expect(r.json().mes).toMatch(/^\d{4}-\d{2}$/);
  });
});
