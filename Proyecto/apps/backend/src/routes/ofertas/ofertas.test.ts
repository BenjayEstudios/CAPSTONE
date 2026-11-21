import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Rutas de ofertas (KAN-146): guardias, codigos HTTP y cableado, con
// repositorios en memoria. Las reglas estan en ofertas.use-cases.test.ts.
const SECRET = "secreto-solo-para-test";
const PERMISOS: Record<number, Record<string, string>> = { 4: { publicar_precio_stock: "total" }, 8: { ver_ordenes_propias: "total" } };
const ofertas = new Map<number, Record<string, unknown>>();

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const permisos = PERMISOS[id];
      return permisos
        ? { usuario: { id, estado: "activo" }, rol: { codigo: "proveedor", permisos }, organizacion: { id: 2, tipo: "proveedor", estado: "activa" } }
        : null;
    }
  },
  DrizzleOfertaRepository: class {
    async listarDeProveedor() { return { items: [...ofertas.values()], total: ofertas.size }; }
    async productosDisponibles() { return { items: [], total: 0 }; }
    async buscarPorId(id: number) { return ofertas.get(id) ?? null; }
    async buscarPorProductoYProveedor() { return null; }
    async productoParaOfertar(id: number) { return { id, nombre: "P", estado: "publicado", precioReferencia: null, topeSobreReferenciaPct: null }; }
    async tieneVentas() { return false; }
    async crear(n: Record<string, unknown>) {
      const o = { id: 50, ...n };
      ofertas.set(50, o);
      return o;
    }
    async actualizar(id: number, c: Record<string, unknown>) {
      ofertas.set(id, { ...ofertas.get(id), ...c });
      return ofertas.get(id);
    }
    async eliminar(id: number) { ofertas.delete(id); }
  },
  DrizzleModeracionRepository: class {}
}));

let app: FastifyInstance;
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { ofertaRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.setErrorHandler(errorHandler);
  ofertaRoutes.forEach((r) => app.route(r));
});

const auth = (sub: number) => ({ authorization: `Bearer ${jwt.sign({ sub: String(sub), organizacionId: 2, rol: "x" }, SECRET)}` });
const PROVEEDOR = auth(4);

describe("rutas de ofertas", () => {
  it("sin token 401; sin publicar_precio_stock 403", async () => {
    expect((await app.inject({ method: "GET", url: "/ofertas" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/ofertas", headers: auth(8) })).statusCode).toBe(403);
  });

  it("crear 201, leer, editar, pausar y no borrar lo publicado", async () => {
    const c = await app.inject({
      method: "POST", url: "/ofertas", headers: PROVEEDOR,
      payload: { productoId: 15, precioUnitario: 1450, modalidadEntrega: "ambos" }
    });
    expect(c.statusCode).toBe(201);
    expect(c.json()).toMatchObject({ oferta: { id: 50, estado: "publicada" }, revisionPrecio: null });
    expect((await app.inject({ method: "GET", url: "/ofertas/50", headers: PROVEEDOR })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/ofertas/productos-disponibles", headers: PROVEEDOR })).statusCode).toBe(200);
    const p = await app.inject({ method: "PATCH", url: "/ofertas/50", headers: PROVEEDOR, payload: { estado: "pausada" } });
    expect(p.json().oferta.estado).toBe("pausada");
    const d = await app.inject({ method: "DELETE", url: "/ofertas/50", headers: PROVEEDOR });
    expect(d.statusCode).toBe(409);
    expect(d.json().error.code).toBe("OFERTA_NO_ELIMINABLE");
  });

  it("borrador se elimina con 204; id invalido 400", async () => {
    ofertas.set(51, { id: 51, proveedorId: 2, estado: "borrador" });
    expect((await app.inject({ method: "DELETE", url: "/ofertas/51", headers: PROVEEDOR })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/ofertas/abc", headers: PROVEEDOR })).statusCode).toBe(400);
  });
});
