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

describe("variables vacias", () => {
  it("una variable vacia del .env cuenta como no definida (el .env.example arranca)", () => {
    const env = loadEnv({ ...base, SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", SMTP_FROM: "", MAIL_OUT_DIR: "", PORT: "" });
    expect(env.SMTP_HOST).toBeUndefined();
    expect(env.PORT).toBe(3000);
  });
  it("las obligatorias vacias siguen fallando", () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: "" })).toThrow();
  });
});

describe("PASARELA (KAN-164)", () => {
  it("webpay por defecto; simulada solo fuera de produccion", async () => {
    expect(loadEnv(base).PASARELA).toBe("webpay");
    expect(loadEnv({ ...base, PASARELA: "simulada" }).PASARELA).toBe("simulada");
    expect(() => loadEnv({ ...base, PASARELA: "simulada", NODE_ENV: "production" })).toThrow(/simulada/);
    expect(() => loadEnv({ ...base, PASARELA: "simulada", WEBPAY_ENTORNO: "produccion", WEBPAY_CODIGO_COMERCIO: "1", WEBPAY_API_KEY: "k" })).toThrow(/simulada/);
    const { crearPasarelaPago } = await import("../lib/pasarela.js");
    expect(crearPasarelaPago(loadEnv({ ...base, PASARELA: "simulada" })).nombre).toBe("simulada");
    expect(crearPasarelaPago(loadEnv(base)).nombre).not.toBe("simulada");
  });
});

describe("PASARELA=paypal (KAN-148)", () => {
  it("exige las credenciales y arma el adaptador PayPal", async () => {
    expect(() => loadEnv({ ...base, PASARELA: "paypal" })).toThrow(/PAYPAL_CLIENT_ID/);
    const env = loadEnv({ ...base, PASARELA: "paypal", PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "sec" });
    expect(env.PAYPAL_ENTORNO).toBe("sandbox");
    expect(env.PAYPAL_CLP_POR_USD).toBe(950);
    const { crearPasarelaPago } = await import("../lib/pasarela.js");
    expect(crearPasarelaPago(env).nombre).toBe("paypal");
  });
});

describe("FASTIFY_TRUST_PROXY", () => {
  it("false por defecto y acepta true", () => {
    expect(loadEnv(base).FASTIFY_TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...base, FASTIFY_TRUST_PROXY: "true" }).FASTIFY_TRUST_PROXY).toBe(true);
    expect(() => loadEnv({ ...base, FASTIFY_TRUST_PROXY: "si" })).toThrow();
  });
});
