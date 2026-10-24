import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;
const enviados: Array<{ para: string; texto: string }> = [];

const permisos: Record<number, Record<string, string>> = {
  1: { crear_usuario: "total", cambiar_permisos: "total" },
  2: { crear_usuario: "parcial" },
  3: { crear_producto: "total" }
};
const fila = { id: 5, nombre: "X", email: "x@t.cl", rut: null, telefono: null, rol: { id: 2, codigo: "e", nombre: "E" }, organizacion: { id: 1, razonSocial: "O", tipo: "interna" }, ultimoAcceso: null, mfaEstado: "inactivo", estado: "invitado" };

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const p = permisos[id];
      return p ? { usuario: { id, estado: "activo" }, rol: { id: 1, permisos: p }, organizacion: {} } : null;
    }
    async buscarPorEmail(email: string) {
      return email === "dup@t.cl" ? {} : null;
    }
  },
  DrizzleUsuarioAdminRepository: class {
    async listar() { return { items: [fila], total: 1 }; }
    async obtener(id: number) { return id === 5 ? fila : null; }
    async opciones() { return { roles: [], organizaciones: [] }; }
    async existeRol() { return true; }
    async existeOrganizacion() { return true; }
    async crear(_d: unknown, aud: (id: number) => unknown) { aud(5); return 5; }
    async contarActivosConPermisoTotal() { return 1; }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });
const body = { nombre: "Nuevo", email: "n@t.cl", rolId: 2, organizacionId: 1, modo: "clave_temporal" };

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { usuarioRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.decorate("servicioCorreo", { enviar: async (c: { para: string; texto: string }) => void enviados.push(c) });
  app.decorate("adminSiteUrl", "http://panel");
  app.setErrorHandler(errorHandler);
  usuarioRoutes.forEach((r) => app.route(r));
});

describe("rutas de usuarios", () => {
  it("sin token 401; sin crear_usuario 403", async () => {
    expect((await app.inject({ method: "GET", url: "/usuarios" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/usuarios", headers: bearer("3") })).statusCode).toBe(403);
  });
  it("lectura con nivel parcial; escritura exige total", async () => {
    expect((await app.inject({ method: "GET", url: "/usuarios", headers: bearer("2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/usuarios/opciones", headers: bearer("2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/usuarios/5", headers: bearer("2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/usuarios", headers: bearer("2"), payload: body })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/usuarios/5/suspender", headers: bearer("2") })).statusCode).toBe(403);
  });
  it("crear clave_temporal: 201, clave una vez, sin hash", async () => {
    const r = await app.inject({ method: "POST", url: "/usuarios", headers: bearer("1"), payload: body });
    expect(r.statusCode).toBe(201);
    expect(r.json().claveTemporal.length).toBeGreaterThanOrEqual(12);
    expect(r.body).not.toContain("hashClave");
  });
  it("crear invitacion: correo enviado, clave no en la respuesta", async () => {
    const r = await app.inject({ method: "POST", url: "/usuarios", headers: bearer("1"), payload: { ...body, modo: "invitacion" } });
    expect(r.statusCode).toBe(201);
    expect(r.json().claveTemporal).toBeUndefined();
    expect(enviados[0]?.para).toBe("n@t.cl");
  });
  it("409 EMAIL_DUPLICADO, 404 y 400", async () => {
    const d = await app.inject({ method: "POST", url: "/usuarios", headers: bearer("1"), payload: { ...body, email: "dup@t.cl" } });
    expect(d.statusCode).toBe(409);
    expect(d.json().error.code).toBe("EMAIL_DUPLICADO");
    expect((await app.inject({ method: "GET", url: "/usuarios/99", headers: bearer("1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/usuarios", headers: bearer("1"), payload: {} })).statusCode).toBe(400);
  });
});
