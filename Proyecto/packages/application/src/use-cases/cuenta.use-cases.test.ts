import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  normalizarRut,
  type CorreoSaliente,
  type CuentaRepository,
  type NuevaCuenta,
  type RecuperacionClaims,
  type UsuarioConContexto,
  type UsuarioRepository
} from "@cotizapp/domain";
import { login } from "./login.use-case.js";
import { registrarComprador, registrarProveedor } from "./registro.use-cases.js";
import { restablecerClave, solicitarRecuperacionClave, type DepsRecuperacion } from "./recuperacion-clave.use-case.js";

const CLAVE = "Cotizapp.2026";
const hashClave = bcrypt.hashSync(CLAVE, 4);
const firmarToken = (c: { sub: string; organizacionId: number; rol: string }) => JSON.stringify(c);

type Over = {
  usuario?: Partial<UsuarioConContexto["usuario"]>;
  organizacion?: Partial<UsuarioConContexto["organizacion"]>;
  rol?: string;
};
function ctx(over: Over = {}): UsuarioConContexto {
  return {
    usuario: {
      id: 8, organizacionId: 6, rolId: 5, nombre: "Compras El Fogon", email: "compras@elfogon.test", rut: null,
      telefono: null, hashClave, mfaEstado: "inactivo", ultimoAcceso: null, estado: "activo", ...over.usuario
    },
    rol: {
      id: 5, codigo: over.rol ?? "comprador", nombre: "Comprador", descripcion: null, esSistema: true,
      permisos: { ver_ordenes_propias: "total" }, permisosActualizadoPor: null, permisosActualizadoEn: null
    },
    organizacion: { id: 6, tipo: "cliente", estado: "activa", nombre: "El Fogon", ...over.organizacion }
  };
}

function usuarios(inicial: UsuarioConContexto[] = []) {
  const filas = [...inicial];
  const accesos: number[] = [];
  const repo: UsuarioRepository = {
    buscarPorEmail: async (e) => filas.find((f) => f.usuario.email === e) ?? null,
    buscarPorId: async (id) => filas.find((f) => f.usuario.id === id) ?? null,
    registrarUltimoAcceso: async (id) => {
      accesos.push(id);
    }
  };
  return { repo, filas, accesos };
}

// Cuenta en memoria que escribe en el mismo arreglo que el UsuarioRepository.
function cuentas(filas: UsuarioConContexto[]) {
  const creadas: NuevaCuenta[] = [];
  const claves: Array<{ id: number; hash: string }> = [];
  const repo: CuentaRepository = {
    crear: async (c) => {
      if (filas.some((f) => f.usuario.email === c.usuario.email)) return { ok: false, conflicto: "email" };
      creadas.push(c);
      const usuarioId = 100 + creadas.length;
      const organizacionId = 50 + creadas.length;
      filas.push(
        ctx({
          usuario: { id: usuarioId, organizacionId, email: c.usuario.email, nombre: c.usuario.nombre, estado: c.usuario.estado },
          organizacion: { id: organizacionId, tipo: c.organizacion.tipo, estado: c.organizacion.estado, nombre: c.organizacion.nombreFantasia ?? c.organizacion.razonSocial },
          rol: c.rolCodigo
        })
      );
      return { ok: true, usuarioId, organizacionId };
    },
    guardarSecretoMfaPendiente: async () => {},
    activarMfa: async () => {},
    actualizarClave: async (id, hash) => {
      claves.push({ id, hash });
      const f = filas.find((x) => x.usuario.id === id);
      if (f) f.usuario.hashClave = hash;
    }
  };
  return { repo, creadas, claves };
}

describe("normalizarRut", () => {
  it("acepta con puntos, guion o sin formato y valida el DV", () => {
    expect(normalizarRut("11.111.111-1")).toBe("11111111-1");
    expect(normalizarRut("76086428-5")).toBe("76086428-5");
    expect(normalizarRut("12345678k")).toBeNull();
    expect(normalizarRut("10.000.013-k")).toBe("10000013-K");
    expect(normalizarRut("abc")).toBeNull();
  });
});

describe("login", () => {
  it("ok: token con claims y usuario con su organizacion", async () => {
    const { repo, accesos } = usuarios([ctx()]);
    const r = await login({ usuarioRepository: repo, firmarToken })({ email: " Compras@ElFogon.test ", clave: CLAVE });
    if (!("token" in r)) throw new Error("se esperaba token");
    expect(JSON.parse(r.token)).toEqual({ sub: "8", organizacionId: 6, rol: "comprador" });
    expect(r.usuario.organizacion).toEqual({ id: 6, nombre: "El Fogon", tipo: "cliente" });
    expect(accesos).toEqual([8]);
  });

  it("clave mala o email inexistente -> mismo 401", async () => {
    const { repo } = usuarios([ctx()]);
    const l = login({ usuarioRepository: repo, firmarToken });
    await expect(l({ email: "compras@elfogon.test", clave: "otra" })).rejects.toMatchObject({ statusCode: 401, code: "CREDENCIALES_INVALIDAS" });
    await expect(l({ email: "nadie@x.test", clave: CLAVE })).rejects.toMatchObject({ statusCode: 401, code: "CREDENCIALES_INVALIDAS" });
  });

  it("proveedor en revision -> 403 USUARIO_NO_ACTIVO y no registra acceso", async () => {
    const { repo, accesos } = usuarios([ctx({ rol: "proveedor", organizacion: { tipo: "proveedor", estado: "en_revision" } })]);
    await expect(login({ usuarioRepository: repo, firmarToken })({ email: "compras@elfogon.test", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 403, code: "USUARIO_NO_ACTIVO" });
    expect(accesos).toEqual([]);
  });

  it("usuario suspendido -> 403 USUARIO_NO_ACTIVO", async () => {
    const { repo } = usuarios([ctx({ usuario: { estado: "suspendido" } })]);
    await expect(login({ usuarioRepository: repo, firmarToken })({ email: "compras@elfogon.test", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 403, code: "USUARIO_NO_ACTIVO" });
  });

  it("interno con 2FA activo y sin deps de MFA -> nunca emite token", async () => {
    const { repo } = usuarios([ctx({ rol: "administrador", usuario: { mfaEstado: "activo" }, organizacion: { tipo: "interna" } })]);
    await expect(login({ usuarioRepository: repo, firmarToken })({ email: "compras@elfogon.test", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 403, code: "MFA_NO_IMPLEMENTADO" });
  });

  it("body invalido -> 400", async () => {
    const { repo } = usuarios();
    await expect(login({ usuarioRepository: repo, firmarToken })({ email: "no-es-email", clave: "" }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("registrarComprador", () => {
  it("persona: organizacion con su nombre y RUT, sesion iniciada", async () => {
    const u = usuarios();
    const c = cuentas(u.filas);
    const r = await registrarComprador({ cuentaRepository: c.repo, usuarioRepository: u.repo, firmarToken })({
      nombre: "Ana Perez", email: "Ana@Test.cl", clave: "Clave1234", rut: "11.111.111-1"
    });
    expect(c.creadas[0]).toMatchObject({
      rolCodigo: "comprador",
      organizacion: { tipo: "cliente", razonSocial: "Ana Perez", rut: "11111111-1", estado: "activa", emailContacto: "ana@test.cl" },
      usuario: { email: "ana@test.cl", rut: "11111111-1", estado: "activo" }
    });
    expect(await bcrypt.compare("Clave1234", c.creadas[0].usuario.hashClave)).toBe(true);
    expect(JSON.parse(r.token)).toEqual({ sub: "101", organizacionId: 51, rol: "comprador" });
    expect(u.accesos).toEqual([101]);
  });

  it("empresa: usa los datos de la empresa", async () => {
    const u = usuarios();
    const c = cuentas(u.filas);
    await registrarComprador({ cuentaRepository: c.repo, usuarioRepository: u.repo, firmarToken })({
      nombre: "Ana", email: "ana@fogon.cl", clave: "Clave1234", rut: "11111111-1",
      empresa: { razonSocial: "Fogon SpA", rut: "76.086.428-5", nombreFantasia: "El Fogon" }
    });
    expect(c.creadas[0].organizacion).toMatchObject({ razonSocial: "Fogon SpA", rut: "76086428-5", nombreFantasia: "El Fogon" });
  });

  it("email repetido -> 409 EMAIL_EN_USO", async () => {
    const u = usuarios([ctx()]);
    const c = cuentas(u.filas);
    await expect(registrarComprador({ cuentaRepository: c.repo, usuarioRepository: u.repo, firmarToken })({
      nombre: "X", email: "compras@elfogon.test", clave: "Clave1234", rut: "11111111-1"
    })).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_EN_USO" });
  });

  it("RUT con DV malo o clave debil -> 400 VALIDACION", async () => {
    const u = usuarios();
    const reg = registrarComprador({ cuentaRepository: cuentas(u.filas).repo, usuarioRepository: u.repo, firmarToken });
    await expect(reg({ nombre: "X", email: "x@t.cl", clave: "Clave1234", rut: "11111111-2" })).rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
    await expect(reg({ nombre: "X", email: "x@t.cl", clave: "solo-letras", rut: "11111111-1" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("registrarProveedor", () => {
  it("crea organizacion proveedor en_revision sin iniciar sesion", async () => {
    const c = cuentas([]);
    const r = await registrarProveedor({ cuentaRepository: c.repo })({
      nombre: "Pedro", email: "ventas@andes.cl", clave: "Clave1234",
      empresa: { razonSocial: "Los Andes Ltda", rut: "76086428-5", giro: "Distribucion" }
    });
    expect(r).toMatchObject({ organizacionId: 51, estado: "en_revision" });
    expect(c.creadas[0]).toMatchObject({ rolCodigo: "proveedor", organizacion: { tipo: "proveedor", estado: "en_revision" } });
  });

  it("abre el caso de moderacion alta_proveedor de la organizacion (KAN-100)", async () => {
    const casos: Array<{ input: unknown; auditoria: unknown }> = [];
    const moderacionRepository = {
      buscarAbierto: async () => null,
      crear: async (input: { tipo: string }, auditoria: (id: number) => unknown) => {
        casos.push({ input, auditoria: auditoria(7) });
        return { id: 7, ...input };
      }
    } as never;
    await registrarProveedor({ cuentaRepository: cuentas([]).repo, moderacionRepository })({
      nombre: "Pedro", email: "ventas@andes.cl", clave: "Clave1234",
      empresa: { razonSocial: "Los Andes Ltda", rut: "76086428-5", giro: "Distribucion" }
    });
    expect(casos[0]!.input).toEqual({
      tipo: "alta_proveedor", entidad: "organizacion", entidadId: 51,
      detalle: "Los Andes Ltda (76086428-5) · Distribucion · contacto Pedro, ventas@andes.cl"
    });
    expect(casos[0]!.auditoria).toMatchObject({ usuarioId: null, entidad: "moderacion_caso", entidadId: 7, datosDespues: { operacion: "abrir_caso" } });
  });

  it("si abrir el caso falla, la solicitud igual queda registrada y se informa", async () => {
    const errores: string[] = [];
    const moderacionRepository = { buscarAbierto: async () => { throw new Error("db"); } } as never;
    const r = await registrarProveedor({ cuentaRepository: cuentas([]).repo, moderacionRepository, log: (m) => void errores.push(m) })({
      nombre: "Pedro", email: "ventas@andes.cl", clave: "Clave1234",
      empresa: { razonSocial: "Los Andes Ltda", rut: "76086428-5" }
    });
    expect(r.estado).toBe("en_revision");
    expect(errores).toEqual(["No se pudo abrir el caso de alta del proveedor 51"]);
  });

  it("sin empresa -> 400", async () => {
    await expect(registrarProveedor({ cuentaRepository: cuentas([]).repo })({
      nombre: "Pedro", email: "v@a.cl", clave: "Clave1234"
    } as never)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("recuperacion de clave", () => {
  const recuperacion: DepsRecuperacion = {
    firmar: (c) => JSON.stringify(c),
    verificar: (t) => {
      try {
        return JSON.parse(t) as RecuperacionClaims;
      } catch {
        return null;
      }
    },
    huella: (h) => h.slice(-12),
    igualesSeguro: (a, b) => a === b,
    urlSitio: (tipo) => (tipo === "interna" ? "http://admin" : "http://shop")
  };
  const correoEnMemoria = () => {
    const enviados: CorreoSaliente[] = [];
    return { enviados, servicio: { enviar: async (c: CorreoSaliente) => void enviados.push(c) } };
  };

  it("email existente: envia enlace al sitio que corresponde; inexistente: misma respuesta sin correo", async () => {
    const u = usuarios([ctx()]);
    const correo = correoEnMemoria();
    const solicitar = solicitarRecuperacionClave({ usuarioRepository: u.repo, servicioCorreo: correo.servicio, recuperacion });
    expect(await solicitar({ email: "compras@elfogon.test" })).toEqual({ ok: true });
    expect(await solicitar({ email: "nadie@x.test" })).toEqual({ ok: true });
    expect(correo.enviados).toHaveLength(1);
    expect(correo.enviados[0].texto).toContain("http://shop/restablecer-clave?token=");
  });

  it("falla del correo no cambia la respuesta", async () => {
    const u = usuarios([ctx()]);
    const errores: unknown[] = [];
    const r = await solicitarRecuperacionClave({
      usuarioRepository: u.repo,
      servicioCorreo: { enviar: async () => { throw new Error("smtp caido"); } },
      recuperacion,
      alFallarCorreo: (e) => errores.push(e)
    })({ email: "compras@elfogon.test" });
    expect(r).toEqual({ ok: true });
    expect(errores).toHaveLength(1);
  });

  it("restablece la clave y el enlace queda de un solo uso", async () => {
    const u = usuarios([ctx()]);
    const c = cuentas(u.filas);
    const token = recuperacion.firmar({ sub: "8", tipo: "recuperacion", huella: recuperacion.huella(hashClave) });
    const restablecer = restablecerClave({ usuarioRepository: u.repo, cuentaRepository: c.repo, recuperacion });
    expect(await restablecer({ token, clave: "NuevaClave9" })).toEqual({ ok: true });
    expect(await bcrypt.compare("NuevaClave9", c.claves[0].hash)).toBe(true);
    await expect(restablecer({ token, clave: "OtraClave99" })).rejects.toMatchObject({ statusCode: 400, code: "ENLACE_INVALIDO" });
  });

  it("token invalido o usuario suspendido -> 400 ENLACE_INVALIDO", async () => {
    const u = usuarios([ctx({ usuario: { estado: "suspendido" } })]);
    const restablecer = restablecerClave({ usuarioRepository: u.repo, cuentaRepository: cuentas(u.filas).repo, recuperacion });
    await expect(restablecer({ token: "no-es-un-token-valido", clave: "NuevaClave9" })).rejects.toMatchObject({ code: "ENLACE_INVALIDO" });
    const token = recuperacion.firmar({ sub: "8", tipo: "recuperacion", huella: recuperacion.huella(hashClave) });
    await expect(restablecer({ token, clave: "NuevaClave9" })).rejects.toMatchObject({ code: "ENLACE_INVALIDO" });
  });
});
