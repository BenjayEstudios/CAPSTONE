import type { RouteOptions } from "fastify";

export const healthCheckRoute: RouteOptions = {
  method: "GET",
  url: "/health-check",
  handler: async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
};
