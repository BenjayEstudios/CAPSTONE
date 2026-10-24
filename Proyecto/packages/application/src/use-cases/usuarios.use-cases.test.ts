import { describe, expect, it } from "vitest";
import type { CorreoSaliente, RegistroAuditoria, UsuarioAdmin, UsuarioAdminRepository, UsuarioConContexto, UsuarioRepository } from "@cotizapp/domain";
import { actualizarUsuario, crearUsuario, reactivarUsuario, suspenderUsuario } from "./usuarios.use-cases.js";

function mk(id: number, over: Partial<UsuarioAdmin> = {}, admin = false): { u: UsuarioAdmin; admin: boolean } {
  return {
    admin,
    u: {
      id, nombre: `U${id}`, email: `u${id}@t.cl`, rut: null, telefono: null,
      rol: { id: admin ? 1 : 2, codigo: admin ? "administrador" : "editor", nombre: "R" },
      organizacion: { id: 1, razonSocial: "Org", tipo: "interna" },
      ultimoAcceso: new Date(), mfaEstado: "inactivo", estado: "activo", ...over
    }
  };
}

function entorno(filas: Array<{ u: UsuarioAdmin; admin: boolean }>) {
  const auditoria: RegistroAuditoria[] = [];
  const creados: Array<Record<string, unknown>> = [];
  const correos: CorreoSaliente[] = [];
  const find = (id: number) => filas.find((f) => f.u.id === id);
  const usuarioAdminRepository: UsuarioAdminRepository = {
    listar: async () => ({ items: filas.map((f) => f.u), total: filas.length }),
    obtener: async (id) => find(id)?.u ?? null,
    opciones: async () => ({ roles: [], organizaciones: [] }),
    existeRol: async (id) => id < 10,
    existeOrganizacion: async (id) => id < 10,
    contarActivosConPermisoTotal: async () => filas.filter((f) => f.admin && f.u.estado === "activo").length,
    crear: async (datos, aud) => {
      const id = 100;
      creados.push({ ...datos });
      auditoria.push(aud(id));
      filas.push(mk(id, { email: datos.email, nombre: datos.nombre, estado: "invitado", ultimoAcceso: null }));
      return id;
    },
    actualizar: async (id, c, a) => {
      Object.assign(find(id)!.u, c.nombre ? { nombre: c.nombre } : {});
      auditoria.push(a);
    },
    cambiarEstado: async (id, estado, a) => {
      find(id)!.u.estado = estado;
      auditoria.push(a);
    }
  };
  const usuarioRepository = {
    buscarPorEmail: async (e: string) => (filas.find((f) => f.u.email === e) ? ({} as UsuarioConContexto) : null),
    buscarPorId: async (id: number) => {
      const f = find(id);
      return f
        ? ({ usuario: { estado: f.u.estado }, rol: { permisos: f.admin ? { cambiar_permisos: "total" } : {} } } as unknown as UsuarioConContexto)
        : null;
    }
  } as unknown as UsuarioRepository;
  const servicioCorreo = { falla: false, enviar: async (c: CorreoSaliente) => { if (servicioCorreo.falla) throw new Error("x"); correos.push(c); } };
  return { usuarioAdminRepository, usuarioRepository, servicioCorreo, auditoria, creados, correos };
}

const base = { nombre: "Nuevo", email: "Nuevo@T.cl", rolId: 2, organizacionId: 1 };

describe("crearUsuario", () => {
  const deps = (e: ReturnType<typeof entorno>) => ({ ...e, generarClave: () => "Clave-Temporal-1", urlPanel: "http://panel" });

  it("clave_temporal: la devuelve, guarda solo el hash y no audita secretos", async () => {
    const e = entorno([mk(1, {}, true)]);
    const r = await crearUsuario(deps(e))({ ...base, modo: "clave_temporal" }, 1);
    expect(r).toMatchObject({ claveTemporal: "Clave-Temporal-1" });
    expect(e.creados[0]!.hashClave).toMatch(/^\$2[aby]\$/);
    expect(e.creados[0]!.email).toBe("nuevo@t.cl");
    expect(JSON.stringify(e.auditoria)).not.toContain("Clave-Temporal-1");
    expect(JSON.stringify(e.auditoria)).not.toContain("$2");
    expect(e.correos).toHaveLength(0);
  });

  it("invitacion: envia correo y no devuelve la clave", async () => {
    const e = entorno([mk(1, {}, true)]);
    const r = await crearUsuario(deps(e))({ ...base, modo: "invitacion", mfa: "activo" }, 1);
    expect(r).not.toHaveProperty("claveTemporal");
    expect(r).toMatchObject({ correoEnviado: true });
    expect(e.correos[0]!.texto).toContain("Clave-Temporal-1");
    expect(e.creados[0]!.mfaEstado).toBe("pendiente");
  });

  it("invitacion con fallo de correo: crea igual con correoEnviado=false", async () => {
    const e = entorno([mk(1, {}, true)]);
    e.servicioCorreo.falla = true;
    expect(await crearUsuario(deps(e))({ ...base, modo: "invitacion" }, 1)).toMatchObject({ correoEnviado: false });
  });

  it("email duplicado -> 409; rol invalido -> 400; body invalido -> 400", async () => {
    const e = entorno([mk(1, {}, true)]);
    await expect(crearUsuario(deps(e))({ ...base, email: "u1@t.cl", modo: "invitacion" }, 1)).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_DUPLICADO" });
    await expect(crearUsuario(deps(e))({ ...base, rolId: 99, modo: "invitacion" }, 1)).rejects.toMatchObject({ code: "ROL_INVALIDO" });
    await expect(crearUsuario(deps(e))({ nombre: "" }, 1)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("suspender / reactivar / actualizar", () => {
  it("no puedes suspenderte", async () => {
    const e = entorno([mk(1, {}, true), mk(2, {}, true)]);
    await expect(suspenderUsuario(e)(1, 1)).rejects.toMatchObject({ code: "BLOQUEO_AUTOSUSPENSION" });
  });
  it("no se suspende al ultimo administrador activo", async () => {
    const e = entorno([mk(1, {}, true), mk(2)]);
    await expect(suspenderUsuario(e)(1, 2)).rejects.toMatchObject({ statusCode: 409, code: "ULTIMO_ADMIN" });
  });
  it("suspende y reactiva (con auditoria)", async () => {
    const e = entorno([mk(1, {}, true), mk(2, {}, true)]);
    expect((await suspenderUsuario(e)(2, 1)).estado).toBe("suspendido");
    expect((await reactivarUsuario(e)(2, 1)).estado).toBe("activo");
    expect(e.auditoria.map((a) => a.accion)).toEqual(["suspender", "editar"]);
    await expect(reactivarUsuario(e)(2, 1)).rejects.toMatchObject({ code: "ESTADO_INVALIDO" });
  });
  it("reactivar a quien nunca ingreso lo deja invitado", async () => {
    const e = entorno([mk(1, {}, true), mk(3, { estado: "suspendido", ultimoAcceso: null })]);
    expect((await reactivarUsuario(e)(3, 1)).estado).toBe("invitado");
  });
  it("no degrada al ultimo admin ni se cambia su propio rol", async () => {
    const e = entorno([mk(1, {}, true), mk(2)]);
    await expect(actualizarUsuario(e)(1, { rolId: 2 }, 2)).rejects.toMatchObject({ code: "ULTIMO_ADMIN" });
    await expect(actualizarUsuario(e)(2, { rolId: 1 }, 2)).rejects.toMatchObject({ code: "BLOQUEO_AUTOEDICION" });
  });
  it("edita nombre y audita solo el diff; 404 si no existe", async () => {
    const e = entorno([mk(1, {}, true), mk(2)]);
    await actualizarUsuario(e)(2, { nombre: "Otro" }, 1);
    expect(e.auditoria[0]).toMatchObject({ datosAntes: { nombre: "U2" }, datosDespues: { nombre: "Otro" } });
    await expect(actualizarUsuario(e)(9, { nombre: "x" }, 1)).rejects.toMatchObject({ statusCode: 404 });
  });
});
