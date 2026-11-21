import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Rutas publicas de cuenta (KAN-144): login, registro y recuperacion de
// clave, con repositorios en memoria en lugar de MySQL.
const SECRET = "secreto-solo-para-test";
const CLAVE = "Cotizapp.2026";
// bcrypt (costo 4) de CLAVE; apps/backend no depende de bcryptjs.
const HASH_CLAVE = "$2b$04$4TPlaVbXbSd9fLZwpb0gPO1txXDd.Xpyd.kRDXaAh3jhRSRwgQyU2";
let app: FastifyInstance;
const enviados: Array<{ para: string; texto: string }> = [];

type Fila = {
  usuario: { id: number; organizacionId: number; nombre: string; email: string; hashClave: string; estado: string; mfaEstado: string };
  rol: { codigo: string; permisos: Record<string, string> };
  organizacion: { id: number; tipo: string; estado: string; nombre: string };
};
const filas: Fila[] = [];
const fila = (id: number, email: string, tipo: string, estadoOrg: string, rol: string): Fila => ({
  usuario: { id, organizacionId: id * 10, nombre: `U${id}`, email, hashClave: HASH_CLAVE, estado: "activo", mfaEstado: "inactivo" },
  rol: { codigo: rol, permisos: {} },
  organizacion: { id: id * 10, tipo, estado: estadoOrg, nombre: `Org ${id}` }
});

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorEmail(email: string) { return filas.find((f) => f.usuario.email === email) ?? null; }
    async buscarPorId(id: number) { return filas.find((f) => f.usuario.id === id) ?? null; }
    async registrarUltimoAcceso() {}
  },
  DrizzleCuentaRepository: class {
    async crear(c: { usuario: { email: string; hashClave: string }; organizacion: { tipo: string; estado: string }; rolCodigo: string }) {
      if (filas.some((f) => f.usuario.email === c.usuario.email)) return { ok: false, conflicto: "email" };
      const id = 100 + filas.length;
      const nueva = fila(id, c.usuario.email, c.organizacion.tipo, c.organizacion.estado, c.rolCodigo);
      nueva.usuario.hashClave = c.usuario.hashClave;
      filas.push(nueva);
      return { ok: true, usuarioId: id, organizacionId: id * 10 };
    }
    async actualizarClave(id: number, hash: string) {
      const f = filas.find((x) => x.usuario.id === id);
      if (f) f.usuario.hashClave = hash;
    }
  }
}));

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  filas.push(fila(1, "compras@elfogon.test", "cliente", "activa", "comprador"));
  filas.push(fila(2, "contacto@laspalmas.test", "proveedor", "en_revision", "proveedor"));
  const { authRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.decorate("servicioCorreo", { enviar: async (c: { para: string; texto: string }) => void enviados.push(c) });
  app.decorate("adminSiteUrl", "http://panel");
  app.decorate("ecommerceUrl", "http://shop/");
  app.setErrorHandler(errorHandler);
  authRoutes.forEach((r) => app.route(r));
});

const post = (url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as object });

describe("POST /auth/login", () => {
  it("200 con JWT verificable y organizacion en el usuario", async () => {
    const res = await post("/auth/login", { email: "compras@elfogon.test", clave: CLAVE });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(jwt.verify(body.token, SECRET)).toMatchObject({ sub: "1", organizacionId: 10, rol: "comprador" });
    expect(body.usuario.organizacion).toEqual({ id: 10, nombre: "Org 1", tipo: "cliente" });
    expect(body.usuario.hashClave).toBeUndefined();
  });
  it("401 clave mala; 403 proveedor en revision; 400 body vacio", async () => {
    expect((await post("/auth/login", { email: "compras@elfogon.test", clave: "x" })).json().error.code).toBe("CREDENCIALES_INVALIDAS");
    const r = await post("/auth/login", { email: "contacto@laspalmas.test", clave: CLAVE });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("USUARIO_NO_ACTIVO");
    expect((await post("/auth/login", {})).statusCode).toBe(400);
  });
});

describe("registro", () => {
  it("comprador: 201 con sesion; repetido 409", async () => {
    const body = { nombre: "Ana", email: "ana@test.cl", clave: "Clave1234", rut: "11.111.111-1" };
    const res = await post("/auth/registro/comprador", body);
    expect(res.statusCode).toBe(201);
    expect(jwt.verify(res.json().token, SECRET)).toMatchObject({ rol: "comprador" });
    const dup = await post("/auth/registro/comprador", body);
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("EMAIL_EN_USO");
  });
  it("proveedor: 201 en revision sin token, y el login responde 403 hasta la aprobacion", async () => {
    const res = await post("/auth/registro/proveedor", {
      nombre: "Pedro", email: "ventas@andes.cl", clave: "Clave1234",
      empresa: { razonSocial: "Los Andes Ltda", rut: "76086428-5" }
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ estado: "en_revision" });
    expect(res.json().token).toBeUndefined();
    expect((await post("/auth/login", { email: "ventas@andes.cl", clave: "Clave1234" })).statusCode).toBe(403);
  });
  it("RUT invalido -> 400 VALIDACION", async () => {
    const res = await post("/auth/registro/comprador", { nombre: "A", email: "a@t.cl", clave: "Clave1234", rut: "1-2" });
    expect(res.statusCode).toBe(400);
  });
});

describe("recuperacion de clave", () => {
  it("202 siempre; el enlace del correo permite fijar una clave nueva una sola vez", async () => {
    enviados.length = 0;
    expect((await post("/auth/recuperar", { email: "nadie@x.cl" })).statusCode).toBe(202);
    expect(enviados).toHaveLength(0);
    expect((await post("/auth/recuperar", { email: "compras@elfogon.test" })).statusCode).toBe(202);
    expect(enviados).toHaveLength(1);
    const url = /http:\/\/shop\/restablecer-clave\?token=(\S+)/.exec(enviados[0].texto);
    expect(url).not.toBeNull();
    const token = decodeURIComponent(url![1]);

    expect((await post("/auth/restablecer", { token, clave: "NuevaClave9" })).statusCode).toBe(200);
    expect((await post("/auth/login", { email: "compras@elfogon.test", clave: "NuevaClave9" })).statusCode).toBe(200);
    const otraVez = await post("/auth/restablecer", { token, clave: "OtraClave99" });
    expect(otraVez.statusCode).toBe(400);
    expect(otraVez.json().error.code).toBe("ENLACE_INVALIDO");
  });
});
