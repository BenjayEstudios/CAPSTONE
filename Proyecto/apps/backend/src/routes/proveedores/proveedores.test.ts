import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const usuarios: Record<number, { estado: string; permisos: Record<string, string> }> = {
  1: { estado: "activo", permisos: { aprobar_proveedor: "total" } },
  2: { estado: "activo", permisos: { crear_producto: "total" } }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const u = usuarios[id];
      return u ? { usuario: { id, estado: u.estado }, rol: { permisos: u.permisos }, organizacion: {} } : null;
    }
  },
  DrizzleProveedorRepository: class {
    async buscarPorId() {
      return null; // ninguna organizacion tipo proveedor existe
    }
    async listar() {
      return { items: [], total: 0 };
    }
  }
}));

const bearer = (sub: string) => ({
  authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "administrador" }, SECRET)}`
});

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { proveedorRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  proveedorRoutes.forEach((r) => app.route(r));
});

describe("rutas de proveedores", () => {
  it("sin token -> 401", async () => {
    expect((await app.inject({ method: "GET", url: "/proveedores" })).statusCode).toBe(401);
  });
  it("sin aprobar_proveedor -> 403", async () => {
    expect((await app.inject({ method: "GET", url: "/proveedores", headers: bearer("2") })).statusCode).toBe(403);
  });
  it("lista paginada con permiso -> 200", async () => {
    const res = await app.inject({ method: "GET", url: "/proveedores?pagina=1&tamano=5", headers: bearer("1") });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ items: [], total: 0, totalPaginas: 1, tamano: 5 });
  });
  it("organizacion que no es proveedor -> 404 PROVEEDOR_NO_ENCONTRADO", async () => {
    const res = await app.inject({ method: "POST", url: "/proveedores/5/aprobar", headers: bearer("1"), payload: {} });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("PROVEEDOR_NO_ENCONTRADO");
  });
  it("motivo faltante al rechazar -> 400; id invalido -> 400 VALIDACION", async () => {
    const a = await app.inject({ method: "POST", url: "/proveedores/5/rechazar", headers: bearer("1"), payload: {} });
    expect(a.statusCode).toBe(400);
    const b = await app.inject({ method: "GET", url: "/proveedores/abc", headers: bearer("1") });
    expect(b.statusCode).toBe(400);
    expect(b.json().error.code).toBe("VALIDACION");
  });
});
