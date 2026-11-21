import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { base32Decodificar, codigoHotp, pasoTotp } from "../../lib/totp.js";

// 2FA TOTP de punta a punta sobre las rutas (KAN-144), con repositorios en memoria.
const CLAVE = "clave-de-prueba-123";
const hashClave = "$2b$04$r9ZmSZ.Peb.icRyK7IWKke4.u1zf.eAxcJ/eCsNHCTUXRc2oSLbMq";
const ctx = {
  usuario: {
    id: 9, organizacionId: 1, rolId: 2, nombre: "Eva", email: "eva@test.cl", rut: null, telefono: null,
    hashClave, mfaEstado: "pendiente", mfaSecreto: null as string | null, ultimoAcceso: null, estado: "activo"
  },
  rol: { codigo: "soporte", permisos: { ver_auditoria: "parcial" } },
  organizacion: { id: 1, tipo: "interna", estado: "activa", nombre: "Cotizapp" }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorEmail(e: string) { return e === ctx.usuario.email ? structuredClone(ctx) : null; }
    async buscarPorId(id: number) { return id === 9 ? structuredClone(ctx) : null; }
    async registrarUltimoAcceso() {}
  },
  DrizzleCuentaRepository: class {
    async guardarSecretoMfaPendiente(_id: number, cifrado: string) {
      ctx.usuario.mfaSecreto = cifrado;
      ctx.usuario.mfaEstado = "pendiente";
    }
    async activarMfa() {
      ctx.usuario.mfaEstado = "activo";
    }
  }
}));

let app: FastifyInstance;
let secreto = "";
const codigoEn = (pasoRelativo: number) => codigoHotp(base32Decodificar(secreto), pasoTotp(Date.now()) + pasoRelativo);
const post = (url: string, payload: object) => app.inject({ method: "POST", url, payload });
const loginAdmin = () => post("/auth/admin/login", { email: "eva@test.cl", clave: CLAVE });

beforeAll(async () => {
  // Reloj fijo a mitad de una ventana de 30 s: los codigos no cambian entre tests.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T12:00:15Z"));
  vi.stubEnv("JWT_SECRET", "secreto-solo-para-test");
  const { authRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.setErrorHandler(errorHandler);
  authRoutes.forEach((r) => app.route(r));
});

describe("2FA TOTP (rutas)", () => {
  it("primer ingreso: pide enrolar, entrega QR y con el primer codigo guarda el secreto cifrado y abre sesion", async () => {
    const r1 = await loginAdmin();
    expect(r1.json()).toMatchObject({ mfaRequerido: true, enrolar: true });
    expect(r1.json().token).toBeUndefined();

    // El desafio de enrolamiento no sirve para verificar un codigo.
    expect((await post("/auth/admin/mfa", { desafio: r1.json().desafio, codigo: "123456" })).statusCode).toBe(401);

    const r2 = await post("/auth/admin/mfa/enrolar", { desafio: r1.json().desafio });
    expect(r2.statusCode).toBe(200);
    const enrol = r2.json();
    expect(enrol.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(enrol.otpauthUrl).toContain(`secret=${enrol.secreto}`);
    expect(enrol.otpauthUrl).toContain("issuer=Cotizapp");
    secreto = enrol.secreto;
    // Queda guardado (cifrado, nunca en claro) pero pendiente hasta confirmar.
    expect(ctx.usuario.mfaEstado).toBe("pendiente");
    expect(ctx.usuario.mfaSecreto).toMatch(/^v1:/);
    expect(ctx.usuario.mfaSecreto).not.toContain(secreto);

    // Salir y volver a entrar antes de confirmar entrega el MISMO QR.
    const otraVez = (await post("/auth/admin/mfa/enrolar", { desafio: (await loginAdmin()).json().desafio })).json();
    expect(otraVez.secreto).toBe(secreto);

    const malo = await post("/auth/admin/mfa/confirmar", { desafio: enrol.desafio, codigo: codigoEn(0) === "000000" ? "111111" : "000000" });
    expect(malo.statusCode).toBe(401);

    const r3 = await post("/auth/admin/mfa/confirmar", { desafio: enrol.desafio, codigo: codigoEn(0) });
    expect(r3.statusCode).toBe(200);
    expect(r3.json().usuario.rol).toBe("soporte");
    expect(ctx.usuario.mfaEstado).toBe("activo");
    expect(ctx.usuario.mfaSecreto).toMatch(/^v1:/);
    expect(ctx.usuario.mfaSecreto).not.toContain(secreto);

    // El desafio de confirmacion es de un solo uso.
    expect((await post("/auth/admin/mfa/confirmar", { desafio: enrol.desafio, codigo: codigoEn(0) })).statusCode).toBe(401);
  });

  it("ingresos siguientes: pide el codigo de la app; un codigo ya usado no sirve de nuevo", async () => {
    const r1 = await loginAdmin();
    expect(r1.json()).toMatchObject({ mfaRequerido: true, enrolar: false });

    // El codigo del paso actual ya se uso al confirmar: se rechaza.
    const reuso = await post("/auth/admin/mfa", { desafio: r1.json().desafio, codigo: codigoEn(0) });
    expect(reuso.statusCode).toBe(401);
    expect(reuso.json().error.code).toBe("MFA_INVALIDO");

    // El del paso siguiente (tolerancia de reloj) todavia no se uso.
    const ok = await post("/auth/admin/mfa", { desafio: r1.json().desafio, codigo: codigoEn(1) });
    expect(ok.statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${ok.json().token}` } });
    expect(me.statusCode).toBe(200);

    // Ya enrolado: no se puede volver a pedir un QR.
    const r2 = await loginAdmin();
    expect((await post("/auth/admin/mfa/enrolar", { desafio: r2.json().desafio })).statusCode).toBe(401);
  });

  it("el login unico tambien exige el 2FA a los internos", async () => {
    const r = await post("/auth/login", { email: "eva@test.cl", clave: CLAVE });
    expect(r.json()).toMatchObject({ mfaRequerido: true, enrolar: false });
    expect(r.json().token).toBeUndefined();
  });

  it("desafio manipulado -> 401; el reenvio por correo ya no existe", async () => {
    const { desafio } = (await loginAdmin()).json();
    expect((await post("/auth/admin/mfa", { desafio: desafio + "x", codigo: codigoEn(-1) })).statusCode).toBe(401);
    expect((await post("/auth/admin/mfa/reenviar", { desafio })).statusCode).toBe(404);
  });
});

afterAll(() => {
  vi.useRealTimers();
});
