import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const ctx = (id: number, tipo: string, orgId: number, permisos: Record<string, string>) => ({
  usuario: { id, estado: "activo", organizacionId: orgId },
  rol: { permisos },
  organizacion: { id: orgId, tipo, estado: "activa" }
});
const usuarios: Record<number, unknown> = {
  1: ctx(1, "interna", 1, { liquidar_proveedor: "total" }),
  2: ctx(2, "interna", 1, { liquidar_proveedor: "parcial" }),
  3: ctx(3, "proveedor", 9, { ver_ordenes_propias: "total" }),
  4: ctx(4, "interna", 1, { crear_producto: "total" })
};
const listarSpy = vi.fn(async (f: { proveedorId?: number }) => ({ items: [], total: 0, f }));

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      return usuarios[id] ?? null;
    }
  },
  DrizzleLiquidacionRepository: class {
    async proveedoresConPendientes() {
      return [];
    }
    listar = listarSpy;
    async buscarPorId(id: number) {
      return id === 5 ? { liquidacion: { id: 5, estado: "pendiente" }, envios: [] } : null;
    }
    async marcarPagada(id: number) {
      return id === 5 ? { resultado: "ok", liquidacion: { id: 5, estado: "pagada" } } : { resultado: "ya_pagada" };
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { liquidacionRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  liquidacionRoutes.forEach((r) => app.route(r));
});

describe("rutas de liquidaciones", () => {
  it("401 sin token; 403 sin permiso", async () => {
    expect((await app.inject({ method: "GET", url: "/liquidaciones" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/liquidaciones", headers: bearer("4") })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/liquidaciones", headers: bearer("3") })).statusCode).toBe(403);
  });
  it("lectura con nivel parcial; escritura exige total", async () => {
    expect((await app.inject({ method: "GET", url: "/liquidaciones", headers: bearer("2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/liquidaciones/generar", headers: bearer("2"), payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/liquidaciones/5/pagar", headers: bearer("2"), payload: { fechaPago: "2026-10-20" } })).statusCode).toBe(403);
  });
  it("generar, detalle, pagar y 409", async () => {
    const g = await app.inject({ method: "POST", url: "/liquidaciones/generar", headers: bearer("1"), payload: { desde: "2026-10-12" } });
    expect(g.statusCode).toBe(200);
    expect(g.json()).toMatchObject({ periodoDesde: "2026-10-12", periodoHasta: "2026-10-18", creadas: 0 });
    expect((await app.inject({ method: "GET", url: "/liquidaciones/5", headers: bearer("1") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/liquidaciones/6", headers: bearer("1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/liquidaciones/5/pagar", headers: bearer("1"), payload: { fechaPago: "2026-10-20" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/liquidaciones/6/pagar", headers: bearer("1"), payload: { fechaPago: "2026-10-20" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: "/liquidaciones/5/pagar", headers: bearer("1"), payload: {} })).statusCode).toBe(400);
  });
  it("/liquidaciones/mias fuerza la organizacion del proveedor", async () => {
    const r = await app.inject({ method: "GET", url: "/liquidaciones/mias?proveedorId=1", headers: bearer("3") });
    expect(r.statusCode).toBe(200);
    expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ proveedorId: 9 }));
    expect((await app.inject({ method: "GET", url: "/liquidaciones/mias", headers: bearer("1") })).statusCode).toBe(403);
  });
});
