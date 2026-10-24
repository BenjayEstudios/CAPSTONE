import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const usuarios: Record<number, { rolId: number; permisos: Record<string, string> }> = {
  1: { rolId: 1, permisos: { cambiar_permisos: "total" } },
  2: { rolId: 2, permisos: { crear_producto: "total" } },
  3: { rolId: 3, permisos: { cambiar_permisos: "parcial" } }
};
const rolesDb = [
  { id: 1, codigo: "administrador", nombre: "Admin", descripcion: null, esSistema: true, permisos: { cambiar_permisos: "total" }, permisosActualizadoPor: null, permisosActualizadoEn: null },
  { id: 2, codigo: "editor", nombre: "Editor", descripcion: null, esSistema: false, permisos: {}, permisosActualizadoPor: null, permisosActualizadoEn: null }
];
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const u = usuarios[id];
      return u ? { usuario: { id, estado: "activo" }, rol: { id: u.rolId, permisos: u.permisos }, organizacion: {} } : null;
    }
  },
  DrizzleRolRepository: class {
    async listar() {
      return rolesDb.map((r) => ({ ...r, usuariosAfectados: 1, permisosActualizadoPorNombre: null }));
    }
    async buscarPorId(id: number) {
      return rolesDb.find((r) => r.id === id) ?? null;
    }
    async actualizarPermisos(id: number, permisos: Record<string, string>, usuarioId: number) {
      return { ...rolesDb.find((r) => r.id === id)!, permisos, permisosActualizadoPor: usuarioId, permisosActualizadoEn: new Date() };
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { rolRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  rolRoutes.forEach((r) => app.route(r));
});

describe("rutas de roles", () => {
  it("sin token -> 401", async () => {
    expect((await app.inject({ method: "GET", url: "/roles" })).statusCode).toBe(401);
  });
  it("sin cambiar_permisos total -> 403 (lectura y escritura)", async () => {
    expect((await app.inject({ method: "GET", url: "/roles", headers: bearer("2") })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/roles", headers: bearer("3") })).statusCode).toBe(403);
    const put = await app.inject({ method: "PUT", url: "/roles/2/permisos", headers: bearer("2"), payload: { permisos: {} } });
    expect(put.statusCode).toBe(403);
  });
  it("lista roles y catalogo", async () => {
    const r = await app.inject({ method: "GET", url: "/roles", headers: bearer("1") });
    expect(r.statusCode).toBe(200);
    expect(r.json().catalogo).toHaveLength(11);
    expect(r.json().roles).toHaveLength(2);
  });
  it("actualiza permisos de un rol", async () => {
    const r = await app.inject({ method: "PUT", url: "/roles/2/permisos", headers: bearer("1"), payload: { permisos: { crear_producto: "total" } } });
    expect(r.statusCode).toBe(200);
    expect(r.json().permisos.crear_producto).toBe("total");
  });
  it("errores: 404, 400 y 409", async () => {
    const put = (id: number, permisos: unknown) =>
      app.inject({ method: "PUT", url: `/roles/${id}/permisos`, headers: bearer("1"), payload: { permisos } });
    expect((await put(99, {})).json().error.code).toBe("ROL_NO_ENCONTRADO");
    expect((await put(2, { x: "total" })).json().error.code).toBe("PERMISO_DESCONOCIDO");
    const b = await put(1, { cambiar_permisos: "ninguno" });
    expect(b.statusCode).toBe(409);
    expect(b.json().error.code).toBe("BLOQUEO_ADMIN");
  });
});
