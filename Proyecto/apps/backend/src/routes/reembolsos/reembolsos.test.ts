import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const u = (id: number, tipo: string, orgId: number, permisos: Record<string, string>) => ({
  usuario: { id, estado: "activo", organizacionId: orgId },
  rol: { permisos },
  organizacion: { id: orgId, tipo, estado: "activa" }
});
const usuarios: Record<number, unknown> = {
  1: u(1, "interna", 1, { emitir_reembolso: "total", ver_todas_ordenes: "total" }),
  2: u(2, "interna", 1, { emitir_reembolso: "parcial" }),
  5: u(5, "cliente", 4, { ver_ordenes_propias: "total" }),
  3: u(3, "proveedor", 2, { ver_ordenes_propias: "total" })
};

const orden = { id: 10, codigo: "CM-10", usuarioId: 5, organizacionId: 4, total: 10000, estado: "pagada", estadoPago: "pagado", requiereFactura: false, referenciaPasarela: null, pagadoEn: new Date() };
const boleta = { id: 1, tipoDte: 39, folio: 1, ordenId: 10, ordenEnvioId: null, emisorRut: "76000000-0", receptorRut: "1-9", neto: 1, iva: 1, total: 10000, estadoSii: "aceptado", trackIdSii: "S", emitidoEn: new Date() };
const detalle = (id: number, tipo: number, usuarioId: number, proveedorId: number | null) => ({
  documento: { ...boleta, id, tipoDte: tipo },
  ordenCodigo: "CM-10", ordenUsuarioId: usuarioId, proveedorId, emisorNombre: "E", receptorNombre: "R", lineas: [], referencia: null, motivo: null
});
const notas: Array<{ id: number; total: number }> = [];

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      return usuarios[id] ?? null;
    }
  },
  DrizzleDocumentoTributarioRepository: class {
    async contextoOrden(id: number) {
      return id === 10
        ? { orden, clienteRut: "1-9", clienteNombre: "C", organizacionRut: "7-7", organizacionNombre: "O", envios: [], documentos: [boleta, ...notas.map((n) => ({ ...boleta, id: n.id, tipoDte: 61, total: n.total }))] }
        : null;
    }
    async buscarOrdenIdPorCodigo(c: string) {
      return c === "CM-10" ? 10 : null;
    }
    async registrarReembolso(_id: number, plan: (c: unknown) => Promise<{ nota: { total: number }; auditoria: (n: unknown) => unknown[] }>) {
      const p = await plan(await this.contextoOrden(10));
      const n = { ...boleta, id: 100 + notas.length, tipoDte: 61, folio: notas.length + 1, total: p.nota.total };
      notas.push({ id: n.id, total: n.total });
      return n;
    }
    async emitirParaOrden() {
      return [];
    }
    async listarReembolsos() {
      return notas.map((n) => ({ nota: { ...boleta, id: n.id, tipoDte: 61, total: n.total }, motivo: "m", usuarioId: 1, creadoEn: new Date() }));
    }
    async listar() {
      return { items: [{ ...boleta, ordenCodigo: "CM-10" }], total: 1 };
    }
    async buscarDetalle(id: number) {
      return id === 1 ? detalle(1, 39, 5, null) : id === 2 ? detalle(2, 52, 9, 2) : id === 3 ? detalle(3, 39, 9, null) : null;
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { reembolsoRoutes } = await import("./index.js");
  const { documentoTributarioRoutes } = await import("../documentos-tributarios/index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  [...reembolsoRoutes, ...documentoTributarioRoutes].forEach((r) => app.route(r));
});

describe("rutas de reembolsos", () => {
  it("permisos: 401 sin token, 403 sin permiso y 403 si el nivel es parcial al escribir", async () => {
    expect((await app.inject({ method: "GET", url: "/ordenes/10/reembolsos" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/ordenes/10/reembolsos", headers: bearer("5") })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/ordenes/10/reembolsos", headers: bearer("2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/ordenes/10/reembolsos", headers: bearer("2"), payload: { motivo: "x" } })).statusCode).toBe(403);
  });
  it("parcial 201, exceso 409 con detalle, total 201, valida body y busca por codigo", async () => {
    const p = await app.inject({ method: "POST", url: "/ordenes/10/reembolsos", headers: bearer("1"), payload: { monto: 4000, motivo: "x" } });
    expect(p.statusCode).toBe(201);
    expect(p.json()).toMatchObject({ saldo: 6000, notaCredito: { tipoDte: 61, total: 4000 } });
    const e = await app.inject({ method: "POST", url: "/ordenes/10/reembolsos", headers: bearer("1"), payload: { monto: 6001, motivo: "x" } });
    expect(e.statusCode).toBe(409);
    expect(e.json().error).toMatchObject({ code: "MONTO_EXCEDE_SALDO", detalle: { saldo: 6000 } });
    expect((await app.inject({ method: "POST", url: "/ordenes/10/reembolsos", headers: bearer("1"), payload: { monto: 5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/ordenes/99/reembolsos", headers: bearer("1"), payload: { motivo: "x" } })).statusCode).toBe(404);
    const b = await app.inject({ method: "GET", url: "/reembolsos/buscar?codigo=CM-10", headers: bearer("1") });
    expect(b.json()).toMatchObject({ orden: { codigo: "CM-10" }, reembolsado: 4000 });
    expect((await app.inject({ method: "GET", url: "/reembolsos/buscar?codigo=CM-1", headers: bearer("1") })).statusCode).toBe(404);
  });
});

describe("rutas de documentos tributarios", () => {
  it("lista con permiso y PDF segun perfil", async () => {
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios", headers: bearer("1") })).json().total).toBe(1);
    const own = await app.inject({ method: "GET", url: "/documentos-tributarios/1/pdf", headers: bearer("5") });
    expect(own.statusCode).toBe(200);
    expect(own.headers["content-type"]).toContain("application/pdf");
    expect(own.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios/3/pdf", headers: bearer("5") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios/2/pdf", headers: bearer("3") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios/1/pdf", headers: bearer("3") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/documentos-tributarios/3/pdf", headers: bearer("1") })).statusCode).toBe(200);
  });
  it("emitir manualmente requiere ver_todas_ordenes total", async () => {
    expect((await app.inject({ method: "POST", url: "/ordenes/10/documentos", headers: bearer("5") })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/ordenes/10/documentos", headers: bearer("1") })).statusCode).toBe(200);
  });
});
