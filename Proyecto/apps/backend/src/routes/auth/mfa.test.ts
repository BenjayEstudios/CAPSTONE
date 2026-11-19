import Fastify from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { CorreoEnMemoria } from "@cotizapp/infrastructure";

const CLAVE = "clave-de-prueba-123";
const hashClave = "$2b$04$r9ZmSZ.Peb.icRyK7IWKke4.u1zf.eAxcJ/eCsNHCTUXRc2oSLbMq";
const ctx = {
  usuario: {
    id: 9, organizacionId: 1, rolId: 2, nombre: "Eva", email: "eva@test.cl", rut: null, telefono: null,
    hashClave, mfaEstado: "activo", ultimoAcceso: null, estado: "activo"
  },
  rol: { codigo: "soporte", permisos: { ver_auditoria: "parcial" } },
  organizacion: { tipo: "interna" }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorEmail(e: string) {
      return e === ctx.usuario.email ? ctx : null;
    }
    async buscarPorId(id: number) {
      return id === 9 ? ctx : null;
    }
    async registrarUltimoAcceso() {}
  }
}));

let app: FastifyInstance;
const correo = new CorreoEnMemoria();
const codigo = () => /es: (\d{6})/.exec(correo.enviados.at(-1)!.texto)![1]!;

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", "secreto-solo-para-test");
  const { authRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("servicioCorreo", correo);
  app.setErrorHandler(errorHandler);
  authRoutes.forEach((r) => app.route(r));
});

const login = () => app.inject({ method: "POST", url: "/auth/admin/login", payload: { email: "eva@test.cl", clave: CLAVE } });

describe("2FA por correo (rutas)", () => {
  it("login -> codigo por correo -> sesion -> /auth/me", async () => {
    const r1 = await login();
    expect(r1.statusCode).toBe(200);
    const { mfaRequerido, desafio, token } = r1.json();
    expect(mfaRequerido).toBe(true);
    expect(token).toBeUndefined();
    expect(r1.body).not.toContain(codigo());
    const r2 = await app.inject({ method: "POST", url: "/auth/admin/mfa", payload: { desafio, codigo: codigo() } });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().usuario.rol).toBe("soporte");
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${r2.json().token}` } });
    expect(me.statusCode).toBe(200);
  });

  it("codigo incorrecto y desafio manipulado -> 401 generico", async () => {
    const { desafio } = (await login()).json();
    const malo = codigo() === "000000" ? "111111" : "000000";
    const r = await app.inject({ method: "POST", url: "/auth/admin/mfa", payload: { desafio, codigo: malo } });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.code).toBe("MFA_INVALIDO");
    const r2 = await app.inject({ method: "POST", url: "/auth/admin/mfa", payload: { desafio: desafio + "x", codigo: codigo() } });
    expect(r2.statusCode).toBe(401);
  });

  it("reenvio entrega un desafio nuevo con otro correo", async () => {
    const { desafio } = (await login()).json();
    const n = correo.enviados.length;
    const r = await app.inject({ method: "POST", url: "/auth/admin/mfa/reenviar", payload: { desafio } });
    expect(r.statusCode).toBe(200);
    expect(correo.enviados.length).toBe(n + 1);
    expect(r.json().desafio).not.toBe(desafio);
  });
});
