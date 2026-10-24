import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

describe("GET /auth/me", () => {
  it("sin token -> 401 UNAUTHORIZED", async () => {
    vi.stubEnv("JWT_SECRET", "secreto-solo-para-test");
    const { meRoute } = await import("./me.js");
    const app = Fastify();
    app.route(meRoute);
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });
});
