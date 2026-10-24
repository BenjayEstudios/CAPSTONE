import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { CorreoSaliente, DesafioMfaClaims, UsuarioConContexto, UsuarioRepository } from "@cotizapp/domain";
import { loginAdmin } from "./login-admin.use-case.js";
import { crearControlMfa, reenviarMfaAdmin, verificarMfaAdmin, type DepsMfa } from "./mfa-admin.use-case.js";

const CLAVE = "clave-de-prueba-123";
const hashClave = bcrypt.hashSync(CLAVE, 4);

function ctx(mfaEstado: "activo" | "inactivo" | "pendiente" | "opcional" = "activo"): UsuarioConContexto {
  return {
    usuario: {
      id: 7, organizacionId: 3, rolId: 1, nombre: "Ana", email: "ana@test.cl", rut: null, telefono: null,
      hashClave, mfaEstado, ultimoAcceso: null, estado: "activo"
    },
    rol: { id: 1, codigo: "soporte", nombre: "Soporte", descripcion: null, esSistema: false, permisos: {}, permisosActualizadoPor: null, permisosActualizadoEn: null },
    organizacion: { id: 3, tipo: "interna", estado: "activa" }
  };
}

function montar(mfaEstado: Parameters<typeof ctx>[0] = "activo") {
  const c = ctx(mfaEstado);
  const accesos: number[] = [];
  const repo: UsuarioRepository = {
    buscarPorEmail: async (e) => (e === c.usuario.email ? c : null),
    buscarPorId: async (id) => (id === c.usuario.id ? c : null),
    registrarUltimoAcceso: async (id) => {
      accesos.push(id);
    }
  };
  const correos: CorreoSaliente[] = [];
  let expirado = false;
  const mfa: DepsMfa = {
    generarCodigo: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    nuevoId: () => randomUUID(),
    hashCodigo: (sub, cod) => createHmac("sha256", "secreto-test").update(sub + ":" + cod).digest("hex"),
    igualesSeguro: (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
    servicioCorreo: { enviar: async (m) => void correos.push(m) },
    firmarDesafio: (cl) => "x.".concat(Buffer.from(JSON.stringify(cl)).toString("base64url")),
    verificarDesafio: (t) => {
      if (expirado || !t.startsWith("x.")) return null;
      try {
        return JSON.parse(Buffer.from(t.slice(2), "base64url").toString()) as DesafioMfaClaims;
      } catch {
        return null;
      }
    },
    control: crearControlMfa()
  };
  const firmarToken = (cl: object) => JSON.stringify(cl);
  const login = () => loginAdmin({ usuarioRepository: repo, firmarToken, mfa })({ email: "ana@test.cl", clave: CLAVE });
  const verificar = verificarMfaAdmin({ usuarioRepository: repo, mfa, firmarToken });
  const reenviar = reenviarMfaAdmin({ usuarioRepository: repo, mfa });
  const codigoEnviado = () => /codigo de verificacion es: (\d{6})/.exec(correos[correos.length - 1]!.texto)![1]!;
  return { login, verificar, reenviar, correos, accesos, codigoEnviado, expirar: () => (expirado = true) };
}

describe("2FA por correo", () => {
  it("paso 1 no entrega token y envia codigo; paso 2 correcto emite sesion", async () => {
    const m = montar();
    const r = await m.login();
    expect(r).toMatchObject({ mfaRequerido: true });
    expect("token" in r).toBe(false);
    expect(m.accesos).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(m.codigoEnviado());
    const s = await m.verificar({ desafio: (r as { desafio: string }).desafio, codigo: m.codigoEnviado() });
    expect(JSON.parse(s.token)).toEqual({ sub: "7", organizacionId: 3, rol: "soporte" });
    expect(m.accesos).toEqual([7]);
  });

  it("codigo incorrecto -> 401 generico y no registra acceso", async () => {
    const m = montar();
    const { desafio } = (await m.login()) as { desafio: string };
    const malo = m.codigoEnviado() === "000000" ? "111111" : "000000";
    await expect(m.verificar({ desafio, codigo: malo })).rejects.toMatchObject({ statusCode: 401, code: "MFA_INVALIDO" });
    expect(m.accesos).toEqual([]);
  });

  it("desafio expirado o manipulado -> 401", async () => {
    const m = montar();
    const { desafio } = (await m.login()) as { desafio: string };
    const codigo = m.codigoEnviado();
    await expect(m.verificar({ desafio: desafio + "A", codigo })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    await expect(m.verificar({ desafio: "basura-basura-basura", codigo })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    // hash alterado: el codigo ya no coincide
    const cl = JSON.parse(Buffer.from(desafio.slice(2), "base64url").toString());
    cl.hash = "00".repeat(32);
    const falso = "x.".concat(Buffer.from(JSON.stringify(cl)).toString("base64url"));
    await expect(m.verificar({ desafio: falso, codigo })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    m.expirar();
    await expect(m.verificar({ desafio, codigo })).rejects.toMatchObject({ statusCode: 401, code: "MFA_INVALIDO" });
  });

  it("codigo de un solo uso y limite de 5 intentos fallidos", async () => {
    const m = montar();
    const { desafio } = (await m.login()) as { desafio: string };
    const codigo = m.codigoEnviado();
    await m.verificar({ desafio, codigo });
    await expect(m.verificar({ desafio, codigo })).rejects.toMatchObject({ code: "MFA_INVALIDO" });

    const m2 = montar();
    const d2 = ((await m2.login()) as { desafio: string }).desafio;
    const c2 = m2.codigoEnviado();
    const malo = c2 === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(m2.verificar({ desafio: d2, codigo: malo })).rejects.toMatchObject({ statusCode: 401 });
    await expect(m2.verificar({ desafio: d2, codigo: c2 })).rejects.toMatchObject({ statusCode: 429, code: "MFA_DEMASIADOS_INTENTOS" });
  });

  it("reenvio: nuevo codigo, invalida el desafio previo y limita a 3", async () => {
    const m = montar();
    const d1 = ((await m.login()) as { desafio: string }).desafio;
    const c1 = m.codigoEnviado();
    const r = await m.reenviar({ desafio: d1 });
    expect(m.correos).toHaveLength(2);
    await expect(m.verificar({ desafio: d1, codigo: c1 })).rejects.toMatchObject({ code: "MFA_INVALIDO" });
    await m.verificar({ desafio: r.desafio, codigo: m.codigoEnviado() });

    const m2 = montar();
    let d = ((await m2.login()) as { desafio: string }).desafio;
    for (let i = 0; i < 3; i++) d = (await m2.reenviar({ desafio: d })).desafio;
    await expect(m2.reenviar({ desafio: d })).rejects.toMatchObject({ statusCode: 429 });
  });

  it.each(["inactivo", "pendiente", "opcional"] as const)("mfa_estado %s no exige 2FA", async (estado) => {
    const m = montar(estado);
    const r = await m.login();
    expect("token" in r).toBe(true);
    expect(m.correos).toHaveLength(0);
  });
});
