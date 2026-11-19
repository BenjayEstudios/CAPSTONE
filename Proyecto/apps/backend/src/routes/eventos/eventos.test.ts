import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
const guardados: Array<Record<string, unknown>> = [];
let falla = false;
let app: FastifyInstance;

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleEventoAnaliticoRepository: class {
    async registrar(e: Array<Record<string, unknown>>) {
      if (falla) throw new Error("db caida");
      guardados.push(...e);
    }
  }
}));

const ev = { tipo_evento: "vista_producto", sesion_id: "qa-tmp-sesion-1", producto_id: 1 };

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  vi.stubEnv("EVENTOS_RATE_LIMIT_MAX", "8");
  const { eventoRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.setErrorHandler(errorHandler);
  eventoRoutes.forEach((r) => app.route(r));
});

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) => app.inject({ method: "POST", url, payload: payload as object, headers });

describe("POST /eventos", () => {
  it("anonimo -> 202 sin cuerpo; con token valido asocia usuario; token invalido se ignora", async () => {
    const r1 = await post("/eventos", ev);
    expect(r1.statusCode).toBe(202);
    expect(r1.body).toBe("");
    await post("/eventos", ev, { authorization: `Bearer ${jwt.sign({ sub: "5", organizacionId: 1, rol: "comprador" }, SECRET)}` });
    const r3 = await post("/eventos", ev, { authorization: "Bearer basura" });
    expect(r3.statusCode).toBe(202);
    expect(guardados.map((g) => g.usuarioId)).toEqual([null, 5, null]);
  });
  it("body invalido o con campos extra -> 400; lote valido -> 202", async () => {
    const r = await post("/eventos", { ...ev, ip: "1.2.3.4" });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("VALIDACION");
    expect((await post("/eventos/lote", { eventos: [ev, ev] })).statusCode).toBe(202);
  });
  it("body mayor a 2 KB -> 413", async () => {
    const r = await post("/eventos", { ...ev, termino: "x".repeat(3000) });
    expect(r.statusCode).toBe(413);
  });
  it("fallo de escritura -> igual 202", async () => {
    falla = true;
    expect((await post("/eventos", ev)).statusCode).toBe(202);
    falla = false;
  });
  it("supera el limite por IP -> 429 con Retry-After", async () => {
    let ultimo = await post("/eventos", ev);
    for (let i = 0; i < 5 && ultimo.statusCode !== 429; i++) ultimo = await post("/eventos", ev);
    expect(ultimo.statusCode).toBe(429);
    expect(ultimo.headers["retry-after"]).toBeDefined();
    expect(ultimo.json().error.code).toBe("RATE_LIMIT");
  });
});
