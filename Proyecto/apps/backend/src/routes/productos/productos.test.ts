import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

const token = (rol: string) => jwt.sign({ sub: "1", organizacionId: 1, rol }, SECRET);

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
      ["PATCH", "/categorias/1"], ["GET", "/categorias?incluirOcultas=true"]
    ] as const) {
      const res = await app.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json().error.code).toBe("UNAUTHORIZED");
    }
  });
  it("otro rol -> 403", async () => {
    const res = await app.inject({ method: "GET", url: "/productos", headers: { authorization: `Bearer ${token("cliente")}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });
  it("id invalido con admin -> 400 VALIDACION (error handler mapea ZodError)", async () => {
    const res = await app.inject({ method: "GET", url: "/productos/abc", headers: { authorization: `Bearer ${token("administrador")}` } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDACION");
  });
  it("query de categorias invalida -> 400", async () => {
    const res = await app.inject({ method: "GET", url: "/categorias?arbol=quizas" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDACION");
  });
});
