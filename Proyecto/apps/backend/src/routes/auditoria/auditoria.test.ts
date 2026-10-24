import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const usuarios: Record<number, { permisos: Record<string, string> }> = {
  1: { permisos: { ver_auditoria: "total" } },
  2: { permisos: { crear_producto: "total" } }
};
const registro = {
  id: 7, accion: "aprobar", entidad: "proveedor", entidadId: 3, usuario: { id: 1, nombre: "Admin" },
  creadoEn: new Date("2026-01-02T10:00:00Z"),
  datosAntes: { estado: "en_revision", hash_clave: "x" },
  datosDespues: { estado: "activa", operacion: "aprobar_proveedor", token: "t" }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const u = usuarios[id];
      return u ? { usuario: { id, estado: "activo" }, rol: { permisos: u.permisos }, organizacion: {} } : null;
    }
  },
  DrizzleAuditoriaRepository: class {
    async listar() {
      return { items: [registro], total: 1 };
    }
    async buscarPorId(id: number) {
      return id === 7 ? registro : null;
    }
    async entidadesDistintas() {
      return ["proveedor"];
    }
    async usuariosEnLog() {
      return [{ id: 1, nombre: "Admin" }];
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "administrador" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { auditoriaRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  auditoriaRoutes.forEach((r) => app.route(r));
});

describe("rutas de auditoria", () => {
  it("sin token -> 401; sin ver_auditoria -> 403", async () => {
    expect((await app.inject({ method: "GET", url: "/auditoria" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/auditoria", headers: bearer("2") })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/auditoria/filtros", headers: bearer("2") })).statusCode).toBe(403);
  });
  it("lista con operacion extraida y sin datos", async () => {
    const res = await app.inject({ method: "GET", url: "/auditoria?accion=aprobar&desde=2026-01-01", headers: bearer("1") });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, pagina: 1, tamano: 20, totalPaginas: 1 });
    expect(res.json().items[0]).toMatchObject({ id: 7, operacion: "aprobar_proveedor" });
    expect(res.json().items[0].datosAntes).toBeUndefined();
  });
  it("fecha, accion o tamano invalidos -> 400 VALIDACION", async () => {
    for (const q of ["desde=2026-13-45", "hasta=ayer", "accion=borrar", "tamano=101"]) {
      const res = await app.inject({ method: "GET", url: `/auditoria?${q}`, headers: bearer("1") });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDACION");
    }
  });
  it("detalle enmascara claves sensibles; inexistente -> 404", async () => {
    const res = await app.inject({ method: "GET", url: "/auditoria/7", headers: bearer("1") });
    expect(res.statusCode).toBe(200);
    expect(res.json().datosAntes).toEqual({ estado: "en_revision", hash_clave: "[oculto]" });
    expect(res.json().datosDespues.token).toBe("[oculto]");
    const nf = await app.inject({ method: "GET", url: "/auditoria/99", headers: bearer("1") });
    expect(nf.statusCode).toBe(404);
    expect(nf.json().error.code).toBe("REGISTRO_NO_ENCONTRADO");
  });
  it("filtros", async () => {
    const res = await app.inject({ method: "GET", url: "/auditoria/filtros", headers: bearer("1") });
    expect(res.json()).toMatchObject({ entidades: ["proveedor"], usuarios: [{ id: 1, nombre: "Admin" }] });
    expect(res.json().acciones).toContain("aprobar");
  });
  it("no hay endpoints de escritura", async () => {
    expect((await app.inject({ method: "DELETE", url: "/auditoria/7", headers: bearer("1") })).statusCode).toBe(404);
  });
});
