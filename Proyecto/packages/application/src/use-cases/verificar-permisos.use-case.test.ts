import { describe, expect, it } from "vitest";
import type { PermisosRol, UsuarioConContexto, UsuarioRepository } from "@cotizapp/domain";
import { verificarPermisos } from "./verificar-permisos.use-case.js";

function repo(permisos: PermisosRol, estado: "activo" | "suspendido" = "activo"): UsuarioRepository {
  const ctx: UsuarioConContexto = {
    usuario: {
      id: 5, organizacionId: 1, rolId: 2, nombre: "U", email: "u@test.cl", rut: null, telefono: null,
      hashClave: "x", mfaEstado: "inactivo", ultimoAcceso: null, estado
    },
    rol: {
      id: 2, codigo: "editor_catalogo", nombre: "E", descripcion: null, esSistema: true, permisos,
      permisosActualizadoPor: null, permisosActualizadoEn: null
    },
    organizacion: { id: 1, tipo: "interna", estado: "activa" }
  };
  return {
    buscarPorEmail: async () => ctx,
    buscarPorId: async (id) => (id === 5 ? ctx : null),
    registrarUltimoAcceso: async () => {}
  };
}

const v = (r: UsuarioRepository) => verificarPermisos({ usuarioRepository: r });

describe("verificarPermisos", () => {
  it("permite total y parcial por defecto", async () => {
    await expect(v(repo({ crear_producto: "total" }))(5, [{ codigo: "crear_producto" }])).resolves.toBeDefined();
    await expect(v(repo({ crear_producto: "parcial" }))(5, [{ codigo: "crear_producto" }])).resolves.toBeDefined();
  });
  it("ninguno o ausente -> 403", async () => {
    await expect(v(repo({ crear_producto: "ninguno" }))(5, [{ codigo: "crear_producto" }])).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    await expect(v(repo({}))(5, [{ codigo: "crear_producto" }])).rejects.toMatchObject({ statusCode: 403 });
  });
  it("minimo total rechaza parcial", async () => {
    await expect(v(repo({ cargar_imagenes: "parcial" }))(5, [{ codigo: "cargar_imagenes", minimo: "total" }])).rejects.toMatchObject({ statusCode: 403 });
  });
  it("basta uno de varios requisitos", async () => {
    await expect(
      v(repo({ cargar_imagenes: "total" }))(5, [{ codigo: "crear_producto" }, { codigo: "cargar_imagenes" }])
    ).resolves.toBeDefined();
  });
  it("usuario inexistente o suspendido -> 401", async () => {
    await expect(v(repo({ crear_producto: "total" }))(99, [{ codigo: "crear_producto" }])).rejects.toMatchObject({ statusCode: 401 });
    await expect(v(repo({ crear_producto: "total" }, "suspendido"))(5, [{ codigo: "crear_producto" }])).rejects.toMatchObject({ statusCode: 401 });
    await expect(v(repo({}))(Number.NaN, [])).rejects.toMatchObject({ statusCode: 401 });
  });
});
