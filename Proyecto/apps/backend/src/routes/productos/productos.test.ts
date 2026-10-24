import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

// Usuarios en memoria que reemplazan a DrizzleUsuarioRepository: los
// permisos se leen "de la DB", no del JWT.
const usuarios: Record<number, { estado: string; permisos: Record<string, string> }> = {
  1: { estado: "activo", permisos: { crear_producto: "total", cargar_imagenes: "total" } }, // administrador
  2: { estado: "activo", permisos: { crear_producto: "total", cargar_imagenes: "total", ver_auditoria: "parcial" } }, // editor_catalogo
  3: { estado: "activo", permisos: { crear_producto: "ninguno", cargar_imagenes: "parcial" } }, // proveedor
  4: { estado: "activo", permisos: { crear_producto: "ninguno", cargar_imagenes: "ninguno" } }, // comprador
  5: { estado: "suspendido", permisos: { crear_producto: "total", cargar_imagenes: "total" } }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const u = usuarios[id];
      return u ? { usuario: { id, estado: u.estado }, rol: { permisos: u.permisos }, organizacion: {} } : null;
    }
  }
}));

const token = (rol: string, sub = "1") => jwt.sign({ sub, organizacionId: 1, rol }, SECRET);
const bearer = (rol: string, sub = "1") => ({ authorization: `Bearer ${token(rol, sub)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { productoRoutes } = await import("./index.js");
  const { categoriaRoutes } = await import("../categorias/index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  [...productoRoutes, ...categoriaRoutes].forEach((r) => app.route(r));
});

describe("auth y validacion de productos/categorias", () => {
  it("sin token -> 401", async () => {
    for (const [method, url] of [
      ["GET", "/productos"], ["POST", "/productos"], ["PATCH", "/productos/1"], ["PUT", "/productos/1/imagenes"],
      ["POST", "/productos/1/imagenes/archivo"], ["PATCH", "/categorias/1"], ["GET", "/categorias?incluirOcultas=true"]
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHORIZED");
    }
  });
  it("sin permiso en la matriz -> 403 aunque el rol del JWT diga administrador", async () => {
    const res = await app.inject({ method: "GET", url: "/productos", headers: bearer("administrador", "4") });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });
  it("proveedor (cargar_imagenes parcial) no gestiona el catalogo global -> 403", async () => {
    for (const [method, url] of [
      ["GET", "/productos"], ["POST", "/productos"], ["PUT", "/productos/1/imagenes"], ["GET", "/categorias?incluirOcultas=true"]
    ] as const) {
      const res = await app.inject({ method, url, headers: bearer("proveedor", "3") });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });
  it("usuario suspendido o inexistente -> 401", async () => {
    for (const sub of ["5", "99"]) {
      const res = await app.inject({ method: "GET", url: "/productos", headers: bearer("administrador", sub) });
      expect(res.statusCode).toBe(401);
    }
  });
  it("editor_catalogo pasa el permiso (llega a la validacion de params)", async () => {
    const res = await app.inject({ method: "GET", url: "/productos/abc", headers: bearer("editor_catalogo", "2") });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDACION");
  });
  it("id invalido con admin -> 400 VALIDACION (error handler mapea ZodError)", async () => {
    const res = await app.inject({ method: "GET", url: "/productos/abc", headers: bearer("administrador") });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDACION");
  });
  it("query de categorias invalida -> 400", async () => {
    const res = await app.inject({ method: "GET", url: "/categorias?arbol=quizas" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDACION");
  });
});
