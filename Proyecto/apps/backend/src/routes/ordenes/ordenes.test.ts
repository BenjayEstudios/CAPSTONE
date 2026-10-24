import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const ctxUsuario = (tipo: string, orgId: number, permisos: Record<string, string>) => ({
  usuario: { estado: "activo", organizacionId: orgId },
  rol: { permisos },
  organizacion: { id: orgId, tipo, estado: "activa" }
});
const usuarios: Record<number, ReturnType<typeof ctxUsuario>> = {
  5: { ...ctxUsuario("cliente", 4, { ver_ordenes_propias: "total" }), usuario: { id: 5, estado: "activo", organizacionId: 4 } } as never,
  3: { ...ctxUsuario("proveedor", 2, { ver_ordenes_propias: "total" }), usuario: { id: 3, estado: "activo", organizacionId: 2 } } as never,
  2: ctxUsuario("interna", 1, { crear_producto: "total" })
};

const envioMem = { id: 1, ordenId: 100, proveedorId: 2, modalidad: "despacho", estado: "por_despachar" };
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      return usuarios[id] ?? null;
    }
  },
  DrizzleCarroRepository: class {
    async obtenerAbierto() {
      return null;
    }
    async guardarItems(usuarioId: number, items: unknown[]) {
      return { id: 1, usuarioId, estado: "abierto", items, actualizadoEn: new Date() };
    }
    async ofertasPorIds() {
      return [{ id: 1, productoId: 1, proveedorId: 2, productoNombre: "A", formato: null, productoPublicado: true, ofertaPublicada: true, precioUnitario: 1000, cajasDisponibles: 5, unidadesPorCaja: 1, minimoCompra: null, plazoHoras: 48, modalidadEntrega: "ambos" }];
    }
    async confirmar() {
      throw Object.assign(new Error("stock"), { statusCode: 409, code: "SIN_STOCK", detalle: { lineas: [{ ofertaId: 1 }] } });
    }
  },
  DrizzleOrdenRepository: class {
    async listar() {
      return { items: [], total: 0 };
    }
    async buscarPorId() {
      return null;
    }
    async buscarEnvio(id: number) {
      return id === 1 ? envioMem : null;
    }
    async cambiarEstadoEnvio(_id: number, plan: (c: unknown) => Promise<unknown>) {
      await plan({
        envio: envioMem,
        orden: { id: 100, estado: "pagada" },
        hermanos: [envioMem],
        entregadosProveedor: async () => []
      });
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { carroRoutes } = await import("../carro/index.js");
  const { ordenRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  [...carroRoutes, ...ordenRoutes].forEach((r) => app.route(r));
});

describe("rutas de carro", () => {
  it("sin token -> 401; proveedor -> 403", async () => {
    expect((await app.inject({ method: "GET", url: "/carro" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/carro", headers: bearer("3") })).statusCode).toBe(403);
  });
  it("GET /carro vacio y PUT /carro valida el body", async () => {
    const g = await app.inject({ method: "GET", url: "/carro", headers: bearer("5") });
    expect(g.json().items).toEqual([]);
    const bad = await app.inject({ method: "PUT", url: "/carro", headers: bearer("5"), payload: { items: [{ ofertaId: 1, cantidad: 0, precioVisto: 1 }] } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: "PUT", url: "/carro", headers: bearer("5"), payload: { items: [{ ofertaId: 1, cantidad: 2, precioVisto: 1000 }] } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().items[0].disponible).toBe(true);
  });
  it("POST /carro/confirmar propaga 409 con detalle por linea", async () => {
    const r = await app.inject({ method: "POST", url: "/carro/confirmar", headers: bearer("5"), payload: {} });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatchObject({ code: "SIN_STOCK", detalle: { lineas: [{ ofertaId: 1 }] } });
  });
});

describe("rutas de ordenes", () => {
  it("permisos: sin token 401, sin ver_ordenes 403", async () => {
    expect((await app.inject({ method: "GET", url: "/ordenes" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/ordenes", headers: bearer("2") })).statusCode).toBe(403);
  });
  it("lista paginada y detalle inexistente 404", async () => {
    const l = await app.inject({ method: "GET", url: "/ordenes?pagina=1", headers: bearer("5") });
    expect(l.json()).toMatchObject({ items: [], total: 0, pagina: 1 });
    expect((await app.inject({ method: "GET", url: "/ordenes/9", headers: bearer("5") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/ordenes/abc", headers: bearer("5") })).statusCode).toBe(400);
  });
  it("PATCH estado: cliente 403, proveedor avanza, transicion invalida 409, envio inexistente 404", async () => {
    const url = "/ordenes/envios/1/estado";
    expect((await app.inject({ method: "PATCH", url, headers: bearer("5"), payload: { estado: "en_preparacion" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url, headers: bearer("3"), payload: { estado: "en_preparacion" } })).statusCode).toBe(200);
    const inv = await app.inject({ method: "PATCH", url, headers: bearer("3"), payload: { estado: "entregado" } });
    expect(inv.statusCode).toBe(409);
    expect(inv.json().error.code).toBe("TRANSICION_INVALIDA");
    expect((await app.inject({ method: "PATCH", url: "/ordenes/envios/7/estado", headers: bearer("3"), payload: { estado: "cancelado" } })).statusCode).toBe(404);
  });
});
