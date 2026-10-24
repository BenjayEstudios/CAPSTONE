import { describe, expect, it } from "vitest";
import type { RegistroAuditoria, Rol, RolRepository, UsuarioRepository } from "@cotizapp/domain";
import { actualizarPermisosRol, listarRoles } from "./roles.use-cases.js";

const rol = (id: number, codigo: string, permisos: Rol["permisos"]): Rol => ({
  id, codigo, nombre: codigo, descripcion: null, esSistema: true, permisos, permisosActualizadoPor: null, permisosActualizadoEn: null
});

function setup() {
  const roles = [
    rol(1, "administrador", { cambiar_permisos: "total", crear_producto: "total" }),
    rol(2, "editor_catalogo", { crear_producto: "parcial" })
  ];
  const auditoria: RegistroAuditoria[] = [];
  const rolRepository: RolRepository = {
    listar: async () => roles.map((r) => ({ ...r, usuariosAfectados: 3, permisosActualizadoPorNombre: null })),
    buscarPorId: async (id) => roles.find((r) => r.id === id) ?? null,
    actualizarPermisos: async (id, permisos, usuarioId, a) => {
      const r = roles.find((x) => x.id === id)!;
      r.permisos = permisos;
      r.permisosActualizadoPor = usuarioId;
      r.permisosActualizadoEn = new Date();
      auditoria.push(a);
      return r;
    }
  };
  // el usuario 10 pertenece al rol administrador (1), el 20 al rol 2
  const usuarioRepository = {
    buscarPorId: async (id: number) => ({ rol: roles.find((r) => r.id === (id === 10 ? 1 : 2))! })
  } as unknown as UsuarioRepository;
  return { roles, auditoria, uc: actualizarPermisosRol({ rolRepository, usuarioRepository }), rolRepository };
}

const falla = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as { statusCode: number; code: string }
  );

describe("listarRoles", () => {
  it("devuelve matriz completa y catalogo de 11 permisos", async () => {
    const { rolRepository } = setup();
    const r = await listarRoles({ rolRepository })();
    expect(r.catalogo).toHaveLength(11);
    expect(Object.keys(r.roles[1].permisos)).toHaveLength(11);
    expect(r.roles[1].permisos.crear_producto).toBe("parcial");
    expect(r.roles[1].permisos.ver_auditoria).toBe("ninguno");
    expect(r.roles[0].permisosActualizadoPor).toBeNull();
  });
});

describe("actualizarPermisosRol", () => {
  it("404 si el rol no existe", async () => {
    const e = await falla(setup().uc(99, { permisos: {} }, 10));
    expect(e).toMatchObject({ statusCode: 404, code: "ROL_NO_ENCONTRADO" });
  });
  it("400 PERMISO_DESCONOCIDO", async () => {
    const e = await falla(setup().uc(2, { permisos: { volar: "total" } }, 10));
    expect(e).toMatchObject({ statusCode: 400, code: "PERMISO_DESCONOCIDO" });
  });
  it("400 VALIDACION con nivel invalido o body invalido", async () => {
    expect(await falla(setup().uc(2, { permisos: { crear_producto: "mucho" } }, 10))).toMatchObject({ code: "VALIDACION" });
    expect(await falla(setup().uc(2, {}, 10))).toMatchObject({ code: "VALIDACION" });
  });
  it("409 BLOQUEO_ADMIN si el administrador pierde cambiar_permisos", async () => {
    const e = await falla(setup().uc(1, { permisos: { cambiar_permisos: "parcial" } }, 20));
    expect(e).toMatchObject({ statusCode: 409, code: "BLOQUEO_ADMIN" });
  });
  it("409 BLOQUEO_AUTOEDICION si quita cambiar_permisos a su propio rol", async () => {
    const s = setup();
    s.roles[1].permisos.cambiar_permisos = "total";
    const e = await falla(s.uc(2, { permisos: { cambiar_permisos: "ninguno" } }, 20));
    expect(e).toMatchObject({ statusCode: 409, code: "BLOQUEO_AUTOEDICION" });
  });
  it("actualiza, fija autor y audita solo los permisos que cambian", async () => {
    const s = setup();
    const r = await s.uc(2, { permisos: { crear_producto: "total", ver_auditoria: "ninguno", cargar_imagenes: "parcial" } }, 10);
    expect(r.cambiado).toBe(true);
    expect(s.roles[1].permisos.crear_producto).toBe("total");
    expect(s.roles[1].permisosActualizadoPor).toBe(10);
    expect(s.auditoria).toEqual([
      {
        usuarioId: 10, entidad: "rol", entidadId: 2, accion: "editar",
        datosAntes: { crear_producto: "parcial", cargar_imagenes: "ninguno" },
        datosDespues: { crear_producto: "total", cargar_imagenes: "parcial" }
      }
    ]);
  });
  it("reemplaza: los codigos omitidos quedan en ninguno", async () => {
    const s = setup();
    await s.uc(2, { permisos: { ver_auditoria: "total" } }, 10);
    expect(s.roles[1].permisos.crear_producto).toBe("ninguno");
    expect(s.auditoria[0].datosAntes).toEqual({ crear_producto: "parcial", ver_auditoria: "ninguno" });
  });
  it("sin cambios reales no escribe ni audita", async () => {
    const s = setup();
    const r = await s.uc(2, { permisos: { crear_producto: "parcial" } }, 10);
    expect(r.cambiado).toBe(false);
    expect(s.auditoria).toHaveLength(0);
    expect(s.roles[1].permisosActualizadoPor).toBeNull();
  });
});
