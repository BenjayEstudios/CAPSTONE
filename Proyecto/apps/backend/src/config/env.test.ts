import cors from "@fastify/cors";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const base = { DATABASE_URL: "mysql://x", JWT_SECRET: "s" };

describe("CORS_ORIGIN", () => {
  it("default incluye ambos frontends", () => {
    expect(loadEnv(base).CORS_ORIGIN).toEqual(["http://localhost:4200", "http://localhost:4300"]);
  });
  it("un solo origen sigue funcionando", () => {
    expect(loadEnv({ ...base, CORS_ORIGIN: "http://a.cl" }).CORS_ORIGIN).toEqual(["http://a.cl"]);
  });
  it("lista con espacios y vacios", () => {
    expect(loadEnv({ ...base, CORS_ORIGIN: " http://a.cl , ,http://b.cl," }).CORS_ORIGIN).toEqual(["http://a.cl", "http://b.cl"]);
  });
  it("preflight: origen permitido vs no permitido", async () => {
    const app = Fastify();
    await app.register(cors, { origin: loadEnv(base).CORS_ORIGIN });
    const pre = (origin: string) =>
      app.inject({
        method: "OPTIONS",
        url: "/auth/admin/login",
        headers: { origin, "access-control-request-method": "POST" }
      });
    expect((await pre("http://localhost:4300")).headers["access-control-allow-origin"]).toBe("http://localhost:4300");
    expect((await pre("http://evil.example")).headers["access-control-allow-origin"]).toBeUndefined();
  });
});
