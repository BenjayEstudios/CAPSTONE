import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { CalificacionError } from "@cotizapp/domain";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const tipo = id === 3 ? "proveedor" : "cliente";
      return { usuario: { id, estado: "activo", organizacionId: 6 }, rol: { codigo: "x", permisos: { ver_ordenes_propias: "total" } }, organizacion: { id: 6, tipo, estado: "activa" } };
    }
  },
  DrizzleCalificacionRepository: class {
    async registrar(input: { ordenEnvioId: number; usuarioId: number; puntaje: number; comentario: string | null }) {
      if (input.ordenEnvioId === 1) throw new CalificacionError("ya_calificado");
      if (input.ordenEnvioId === 21) throw new CalificacionError("envio_no_calificable");
      return { id: 30, ...input, creadaEn: new Date("2026-11-20T12:00:00Z") };
    }
  }
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 6, rol: "x" }, SECRET)}` });
const post = (envio: number, payload: object, sub = "8") =>
  app.inject({ method: "POST", url: `/ordenes/envios/${envio}/calificacion`, headers: bearer(sub), payload });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { calificarEnvioRoute } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  app.route(calificarEnvioRoute);
});

describe("POST /ordenes/envios/:id/calificacion (KAN-99)", () => {
  it("exige sesion y responde 201 con la calificacion", async () => {
    expect((await app.inject({ method: "POST", url: "/ordenes/envios/5/calificacion", payload: { puntaje: 4 } })).statusCode).toBe(401);
    const r = await post(5, { puntaje: 4, comentario: "Bien" });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ id: 30, ordenEnvioId: 5, usuarioId: 8, puntaje: 4, comentario: "Bien" });
  });

  it("409 YA_CALIFICADO, 409 ENVIO_NO_CALIFICABLE, 400 VALIDACION y 403 para un proveedor", async () => {
    expect((await post(1, { puntaje: 5 })).json().error.code).toBe("YA_CALIFICADO");
    const noEntregado = await post(21, { puntaje: 5 });
    expect([noEntregado.statusCode, noEntregado.json().error.code]).toEqual([409, "ENVIO_NO_CALIFICABLE"]);
    expect((await post(5, { puntaje: 0 })).statusCode).toBe(400);
    expect((await post(5, { puntaje: 4 }, "3")).statusCode).toBe(403);
  });
});
