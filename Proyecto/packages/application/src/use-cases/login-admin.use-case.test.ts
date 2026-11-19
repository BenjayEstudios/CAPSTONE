import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type { UsuarioConContexto, UsuarioRepository } from "@cotizapp/domain";
import { loginAdmin } from "./login-admin.use-case.js";
import { obtenerSesionUsuario } from "./obtener-sesion-usuario.use-case.js";

const CLAVE = "clave-de-prueba-123";
const hashClave = bcrypt.hashSync(CLAVE, 4);

function crearCtx(over: {
  usuario?: Partial<UsuarioConContexto["usuario"]>;
  tipoOrg?: "interna" | "cliente" | "proveedor";
} = {}): UsuarioConContexto {
  return {
    usuario: {
      id: 7, organizacionId: 3, rolId: 1, nombre: "Admin", email: "admin@test.cl", rut: null,
      telefono: null, hashClave, mfaEstado: "inactivo", ultimoAcceso: null, estado: "activo",
      ...over.usuario
    },
    rol: {
      id: 1, codigo: "administrador", nombre: "Administrador", descripcion: null, esSistema: true,
      permisos: { crear_producto: "total" }, permisosActualizadoPor: null, permisosActualizadoEn: null
    },
    organizacion: { id: 3, tipo: over.tipoOrg ?? "interna", estado: "activa" }
  };
}

function repoEnMemoria(ctx: UsuarioConContexto | null) {
  const accesos: Array<{ id: number; fecha: Date }> = [];
  const repo: UsuarioRepository = {
    buscarPorEmail: async (email) => (ctx && ctx.usuario.email === email ? ctx : null),
    buscarPorId: async (id) => (ctx && ctx.usuario.id === id ? ctx : null),
    registrarUltimoAcceso: async (id, fecha) => {
      accesos.push({ id, fecha });
    }
  };
  return { repo, accesos };
}

const firmarToken = (c: { sub: string; organizacionId: number; rol: string }) => JSON.stringify(c);

describe("loginAdmin", () => {
  it("login ok: firma claims exactos y registra ultimo acceso", async () => {
    const { repo, accesos } = repoEnMemoria(crearCtx());
    const fecha = new Date("2026-01-01T00:00:00Z");
    const r = await loginAdmin({ usuarioRepository: repo, firmarToken, ahora: () => fecha })({
      email: "Admin@Test.cl", clave: CLAVE
    });
    expect(JSON.parse((r as { token: string }).token)).toEqual({ sub: "7", organizacionId: 3, rol: "administrador" });
    expect((r as { usuario: unknown }).usuario).toEqual({
      id: 7, nombre: "Admin", email: "admin@test.cl", organizacionId: 3,
      rol: "administrador", permisos: { crear_producto: "total" }
    });
    expect(accesos).toEqual([{ id: 7, fecha }]);
  });

  it("clave mala -> 401 generico", async () => {
    const { repo } = repoEnMemoria(crearCtx());
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "admin@test.cl", clave: "otra" }))
      .rejects.toMatchObject({ statusCode: 401, code: "CREDENCIALES_INVALIDAS" });
  });

  it("email inexistente -> mismo 401", async () => {
    const { repo } = repoEnMemoria(null);
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "x@test.cl", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 401, code: "CREDENCIALES_INVALIDAS" });
  });

  it("usuario suspendido -> 401", async () => {
    const { repo, accesos } = repoEnMemoria(crearCtx({ usuario: { estado: "suspendido" } }));
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "admin@test.cl", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(accesos).toHaveLength(0);
  });

  it("organizacion no interna -> 401", async () => {
    const { repo } = repoEnMemoria(crearCtx({ tipoOrg: "cliente" }));
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "admin@test.cl", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("mfa activo sin dependencias mfa -> 403 MFA_NO_IMPLEMENTADO", async () => {
    const { repo } = repoEnMemoria(crearCtx({ usuario: { mfaEstado: "activo" } }));
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "admin@test.cl", clave: CLAVE }))
      .rejects.toMatchObject({ statusCode: 403, code: "MFA_NO_IMPLEMENTADO" });
  });

  it("body invalido -> 400", async () => {
    const { repo } = repoEnMemoria(null);
    await expect(loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "no-es-email", clave: "" }))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
  });
});

describe("obtenerSesionUsuario", () => {
  it("devuelve el usuario", async () => {
    const { repo } = repoEnMemoria(crearCtx());
    expect((await obtenerSesionUsuario({ usuarioRepository: repo })(7)).rol).toBe("administrador");
  });
  it("suspendido o inexistente -> 401", async () => {
    const { repo } = repoEnMemoria(crearCtx({ usuario: { estado: "suspendido" } }));
    await expect(obtenerSesionUsuario({ usuarioRepository: repo })(7)).rejects.toMatchObject({ statusCode: 401 });
    await expect(obtenerSesionUsuario({ usuarioRepository: repo })(99)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("loginAdmin con usuario invitado", () => {
  it("acepta estado invitado con su clave temporal", async () => {
    const { repo, accesos } = repoEnMemoria(crearCtx({ usuario: { estado: "invitado" } }));
    const r = await loginAdmin({ usuarioRepository: repo, firmarToken })({ email: "admin@test.cl", clave: CLAVE });
    expect(JSON.parse((r as { token: string }).token).sub).toBe("7");
    expect(accesos).toHaveLength(1);
  });
});
