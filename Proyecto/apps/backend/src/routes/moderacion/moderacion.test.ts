import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const usuarios: Record<number, { permisos: Record<string, string> }> = {
  1: { permisos: { aprobar_proveedor: "total" } },
  2: { permisos: { aprobar_proveedor: "ninguno", crear_producto: "total" } }
};
const casos: any[] = [];
const auditoria: any[] = [];
const nuevo = (id: number) => ({
  id, tipo: "alta_proveedor", entidad: "organizacion", entidadId: 9, detalle: null, estado: "abierto",
  asignadoA: null, creadoEn: new Date("2026-01-01T00:00:00Z"), resueltoEn: null
});

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const u = usuarios[id];
      return u ? { usuario: { id, estado: "activo" }, rol: { permisos: u.permisos }, organizacion: {} } : null;
    }
  },
  DrizzleModeracionRepository: class {
    async listar() { return { items: casos, total: casos.length }; }
    async buscarPorId(id: number) { return casos.find((c) => c.id === id) ?? null; }
    async historial() { return []; }
    async resolverEntidad() { return { entidad: "organizacion", id: 9, etiqueta: "Prov" }; }
    async usuariosInternos() { return [{ id: 1, nombre: "Admin", rol: "administrador" }]; }
    async cambiar(id: number, c: any, a: any) {
      const x = casos.find((k) => k.id === id);
      if (x.estado !== "abierto") return null;
      Object.assign(x, c.estado ? { estado: c.estado } : {}, c.asignadoA !== undefined ? { asignadoA: c.asignadoA && { id: c.asignadoA, nombre: "Admin" } } : {});
      auditoria.push(a);
      return x;
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "administrador" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  casos.push(nuevo(1), nuevo(2));
  const { moderacionRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  moderacionRoutes.forEach((r) => app.route(r));
});

describe("rutas de moderacion", () => {
  it("401 sin token y 403 sin permiso", async () => {
    expect((await app.inject({ method: "GET", url: "/moderacion/casos" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/moderacion/casos", headers: bearer("2") })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/moderacion/casos/1/resolver", headers: bearer("2"), payload: { nota: "x" } })).statusCode).toBe(403);
  });
  it("lista, detalle, 404 y filtro invalido", async () => {
    const l = await app.inject({ method: "GET", url: "/moderacion/casos?estado=abierto&asignadoA=sin_asignar", headers: bearer("1") });
    expect(l.statusCode).toBe(200);
    expect(l.json()).toMatchObject({ total: 2, pagina: 1 });
    const d = await app.inject({ method: "GET", url: "/moderacion/casos/1", headers: bearer("1") });
    expect(d.json().entidadReferenciada.etiqueta).toBe("Prov");
    expect((await app.inject({ method: "GET", url: "/moderacion/casos/99", headers: bearer("1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/moderacion/casos?tipo=zzz", headers: bearer("1") })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/moderacion/usuarios-internos", headers: bearer("1") })).json().items).toHaveLength(1);
  });
  it("asignar -> resolver; luego 409; descartar exige motivo", async () => {
    const h = bearer("1");
    const a = await app.inject({ method: "POST", url: "/moderacion/casos/1/asignar", headers: h, payload: { usuarioId: 1 } });
    expect(a.statusCode).toBe(200);
    expect(a.json().asignadoA.id).toBe(1);
    expect((await app.inject({ method: "POST", url: "/moderacion/casos/1/resolver", headers: h, payload: {} })).statusCode).toBe(400);
    const r = await app.inject({ method: "POST", url: "/moderacion/casos/1/resolver", headers: h, payload: { nota: "ok" } });
    expect(r.json().estado).toBe("resuelto");
    const c = await app.inject({ method: "POST", url: "/moderacion/casos/1/descartar", headers: h, payload: { motivo: "x" } });
    expect(c.statusCode).toBe(409);
    expect(c.json().error.code).toBe("TRANSICION_INVALIDA");
    expect((await app.inject({ method: "POST", url: "/moderacion/casos/2/descartar", headers: h, payload: { motivo: "dup" } })).json().estado).toBe("descartado");
    expect(auditoria.map((x) => x.datosDespues.operacion)).toEqual(["asignar_caso", "resolver_caso", "descartar_caso"]);
    expect(auditoria[0].usuarioId).toBe(1);
  });
});
