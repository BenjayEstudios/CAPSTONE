import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { CuentaRepository, DesafioMfaClaims, UsuarioConContexto, UsuarioMfaEstado, UsuarioRepository } from "@cotizapp/domain";
import { loginAdmin } from "./login-admin.use-case.js";
import { login } from "./login.use-case.js";
import {
  confirmarEnrolamientoMfa,
  crearControlMfa,
  iniciarEnrolamientoMfa,
  verificarMfaAdmin,
  type DepsMfa
} from "./mfa-admin.use-case.js";

const CLAVE = "clave-de-prueba-123";
const hashClave = bcrypt.hashSync(CLAVE, 4);
// Codigos validos del fake: "111111" calza en el paso 100 y "222222" en el 101.
const PASOS: Record<string, number> = { "111111": 100, "222222": 101 };

function montar(o: { mfaEstado?: UsuarioMfaEstado; mfaSecreto?: string | null; tipoOrg?: "interna" | "cliente"; estado?: "activo" | "suspendido" } = {}) {
  const c: UsuarioConContexto = {
    usuario: {
      id: 7, organizacionId: 3, rolId: 1, nombre: "Ana", email: "ana@test.cl", rut: null, telefono: null, hashClave,
      mfaEstado: o.mfaEstado ?? "activo", mfaSecreto: o.mfaSecreto === undefined ? "cifrado:SECRETO" : o.mfaSecreto,
      ultimoAcceso: null, estado: o.estado ?? "activo"
    },
    rol: { id: 1, codigo: "soporte", nombre: "Soporte", descripcion: null, esSistema: false, permisos: {}, permisosActualizadoPor: null, permisosActualizadoEn: null },
    organizacion: { id: 3, tipo: o.tipoOrg ?? "interna", estado: "activa", nombre: "Cotizapp" }
  };
  const accesos: number[] = [];
  const usuarios: UsuarioRepository = {
    buscarPorEmail: async (e) => (e === c.usuario.email ? c : null),
    buscarPorId: async (id) => (id === c.usuario.id ? c : null),
    registrarUltimoAcceso: async (id) => void accesos.push(id)
  };
  const cuentas: CuentaRepository = {
    crear: async () => ({ ok: false, conflicto: "email" }),
    actualizarClave: async () => {},
    guardarSecretoMfaPendiente: async (_id, cifrado) => {
      c.usuario.mfaSecreto = cifrado;
      c.usuario.mfaEstado = "pendiente";
    },
    activarMfa: async () => {
      c.usuario.mfaEstado = "activo";
    }
  };
  let generados = 0;
  const mfa: DepsMfa = {
    // Cada llamada genera uno distinto: asi se nota si un re-ingreso cambia el QR.
    generarSecreto: () => (++generados === 1 ? "NUEVO" : `NUEVO${generados}`),
    verificarCodigo: (secreto, codigo) => (secreto === "SECRETO" || secreto.startsWith("NUEVO") ? PASOS[codigo] ?? null : null),
    cifrar: (s) => `cifrado:${s}`,
    descifrar: (s) => (s.startsWith("cifrado:") ? s.slice(8) : null),
    otpauthUrl: (email, s) => `otpauth://totp/Cotizapp:${email}?secret=${s}`,
    qrDataUrl: async (t) => `data:image/png;base64,${Buffer.from(t).toString("base64")}`,
    nuevoId: (() => { let n = 0; return () => `jti-${++n}`; })(),
    firmarDesafio: (cl) => "x." + Buffer.from(JSON.stringify(cl)).toString("base64url"),
    verificarDesafio: (t) => {
      if (!t.startsWith("x.")) return null;
      try { return JSON.parse(Buffer.from(t.slice(2), "base64url").toString()) as DesafioMfaClaims; } catch { return null; }
    },
    control: crearControlMfa()
  };
  const firmarToken = (cl: object) => JSON.stringify(cl);
  return {
    c, accesos, mfa,
    login: () => loginAdmin({ usuarioRepository: usuarios, firmarToken, mfa })({ email: "ana@test.cl", clave: CLAVE }),
    verificar: verificarMfaAdmin({ usuarioRepository: usuarios, mfa, firmarToken }),
    enrolar: iniciarEnrolamientoMfa({ usuarioRepository: usuarios, cuentaRepository: cuentas, mfa }),
    confirmar: confirmarEnrolamientoMfa({ usuarioRepository: usuarios, cuentaRepository: cuentas, mfa, firmarToken }),
    loginUnico: () => login({ usuarioRepository: usuarios, firmarToken, mfa })({ email: "ana@test.cl", clave: CLAVE })
  };
}

const desafioDe = (r: unknown) => (r as { desafio: string }).desafio;

describe("2FA TOTP: cuando se exige", () => {
  it("activo con secreto -> pide codigo; pendiente o activo sin secreto -> pide enrolar", async () => {
    expect(await montar().login()).toMatchObject({ mfaRequerido: true, enrolar: false });
    expect(await montar({ mfaEstado: "pendiente", mfaSecreto: null }).login()).toMatchObject({ mfaRequerido: true, enrolar: true });
    expect(await montar({ mfaEstado: "activo", mfaSecreto: null }).login()).toMatchObject({ mfaRequerido: true, enrolar: true });
  });

  it("opcional o inactivo -> sesion directa; un no interno nunca recibe 2FA en el login unico", async () => {
    for (const mfaEstado of ["opcional", "inactivo"] as const) {
      expect(await montar({ mfaEstado, mfaSecreto: null }).login()).toHaveProperty("token");
    }
    expect(await montar({ tipoOrg: "cliente" }).loginUnico()).toHaveProperty("token");
    expect(await montar().loginUnico()).toMatchObject({ mfaRequerido: true });
  });
});

describe("2FA TOTP: verificacion", () => {
  it("codigo correcto emite sesion y registra el acceso", async () => {
    const m = montar();
    const r = await m.verificar({ desafio: desafioDe(await m.login()), codigo: "111111" });
    expect(JSON.parse(r.token)).toEqual({ sub: "7", organizacionId: 3, rol: "soporte" });
    expect(m.accesos).toEqual([7]);
  });

  it("un codigo ya aceptado no sirve de nuevo en su ventana, aunque llegue con otro desafio", async () => {
    const m = montar();
    await m.verificar({ desafio: desafioDe(await m.login()), codigo: "111111" });
    await expect(m.verificar({ desafio: desafioDe(await m.login()), codigo: "111111" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    expect(await m.verificar({ desafio: desafioDe(await m.login()), codigo: "222222" })).toHaveProperty("token");
  });

  it("5 fallos bloquean (429) aunque despues llegue el codigo correcto", async () => {
    const m = montar();
    const desafio = desafioDe(await m.login());
    for (let i = 0; i < 5; i++) await expect(m.verificar({ desafio, codigo: "999999" })).rejects.toMatchObject({ statusCode: 401 });
    await expect(m.verificar({ desafio, codigo: "111111" })).rejects.toMatchObject({ statusCode: 429, code: "MFA_DEMASIADOS_INTENTOS" });
  });

  it("desafio de otro tipo, secreto ilegible o usuario suspendido -> 401", async () => {
    const pend = montar({ mfaEstado: "pendiente", mfaSecreto: null });
    await expect(pend.verificar({ desafio: desafioDe(await pend.login()), codigo: "111111" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });

    const roto = montar({ mfaSecreto: "basura" });
    await expect(roto.verificar({ desafio: desafioDe(await roto.login()), codigo: "111111" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });

    const m = montar();
    const desafio = desafioDe(await m.login());
    m.c.usuario.estado = "suspendido";
    await expect(m.verificar({ desafio, codigo: "111111" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
  });

  it("sin deps de MFA el login nunca omite el 2FA", async () => {
    const m = montar();
    await expect(loginAdmin({ usuarioRepository: { buscarPorEmail: async () => m.c, buscarPorId: async () => m.c, registrarUltimoAcceso: async () => {} }, firmarToken: () => "t" })({ email: "ana@test.cl", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 403, code: "MFA_NO_IMPLEMENTADO" });
  });
});

describe("2FA TOTP: enrolamiento", () => {
  it("entrega secreto + QR; lo guarda cifrado como pendiente y el primer codigo lo activa", async () => {
    const m = montar({ mfaEstado: "pendiente", mfaSecreto: null });
    const e = await m.enrolar({ desafio: desafioDe(await m.login()) });
    expect(e).toMatchObject({ secreto: "NUEVO", otpauthUrl: "otpauth://totp/Cotizapp:ana@test.cl?secret=NUEVO" });
    expect(e.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(m.c.usuario).toMatchObject({ mfaEstado: "pendiente", mfaSecreto: "cifrado:NUEVO" });

    await expect(m.confirmar({ desafio: e.desafio, codigo: "999999" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    const r = await m.confirmar({ desafio: e.desafio, codigo: "111111" });
    expect(r).toHaveProperty("token");
    expect(m.c.usuario).toMatchObject({ mfaEstado: "activo", mfaSecreto: "cifrado:NUEVO" });

    // Desafio de confirmacion de un solo uso, y ya no se puede re-enrolar.
    await expect(m.confirmar({ desafio: e.desafio, codigo: "222222" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    await expect(m.enrolar({ desafio: desafioDe(await m.login()) })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
  });

  it("si sale y vuelve a entrar antes de confirmar, recibe el MISMO secreto (la cuenta ya agregada a la app sigue sirviendo)", async () => {
    const m = montar({ mfaEstado: "pendiente", mfaSecreto: null });
    const primero = await m.enrolar({ desafio: desafioDe(await m.login()) });
    const segundo = await m.enrolar({ desafio: desafioDe(await m.login()) });
    expect(segundo.secreto).toBe(primero.secreto);
    expect(segundo.otpauthUrl).toBe(primero.otpauthUrl);
    expect(await m.confirmar({ desafio: segundo.desafio, codigo: "111111" })).toHaveProperty("token");
  });

  it("un secreto pendiente ilegible (ej. cambio la clave de cifrado) se reemplaza por uno nuevo", async () => {
    const m = montar({ mfaEstado: "pendiente", mfaSecreto: "basura" });
    const e = await m.enrolar({ desafio: desafioDe(await m.login()) });
    expect(m.c.usuario.mfaSecreto).toBe(`cifrado:${e.secreto}`);
  });

  it("no se puede enrolar con un desafio de codigo ni confirmar con uno de enrolamiento", async () => {
    const act = montar();
    await expect(act.enrolar({ desafio: desafioDe(await act.login()) })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    const pend = montar({ mfaEstado: "pendiente", mfaSecreto: null });
    await expect(pend.confirmar({ desafio: desafioDe(await pend.login()), codigo: "111111" })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
  });
});
