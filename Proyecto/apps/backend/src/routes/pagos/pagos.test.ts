import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { PasarelaEnMemoria } from "@cotizapp/infrastructure";

const SECRET = "secreto-solo-para-test";
let app: FastifyInstance;
let pasarela: PasarelaEnMemoria;

// Orden en memoria compartida por los repositorios falsos.
const st = vi.hoisted(() => ({
  orden: null as null | Record<string, unknown>,
  documentos: [] as number[]
}));
const ordenInicial = () => ({
  id: 12, codigo: "CM-90012", usuarioId: 8, organizacionId: 6, total: 80150, estado: "pendiente_pago", estadoPago: "autorizado",
  medioPago: null, referenciaPasarela: null
});

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      return { usuario: { id, estado: "activo", organizacionId: 6 }, rol: { codigo: "comprador", permisos: { ver_ordenes_propias: "total" } }, organizacion: { id: 6, tipo: "cliente", estado: "activa" } };
    }
  },
  DrizzleOrdenRepository: class {
    async buscarPorId(id: number, alcance: { usuarioId?: number }) {
      const o = st.orden!;
      return id === o.id && alcance.usuarioId === o.usuarioId ? { orden: o, envios: [], clienteNombre: "", organizacionNombre: "", direccionEntrega: null } : null;
    }
    async buscarPorReferenciaPasarela(ref: string) {
      return st.orden!.referenciaPasarela === ref ? st.orden : null;
    }
    async registrarInicioPago(_id: number, ref: string) {
      st.orden = { ...st.orden!, referenciaPasarela: ref };
    }
    async registrarResultadoPago(_id: number, r: { aprobado: boolean }) {
      if (st.orden!.estado !== "pendiente_pago") return false;
      st.orden = r.aprobado ? { ...st.orden!, estado: "pagada", estadoPago: "pagado" } : { ...st.orden!, estadoPago: "fallido" };
      return true;
    }
  },
  DrizzleDocumentoTributarioRepository: class {},
  DrizzleComunaRepository: class {
    async listar() {
      return [{ id: 20, nombre: "Ñuñoa", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" }];
    }
  }
}));

// La emision de documentos se reemplaza: solo se registra que se pidio.
vi.mock("@cotizapp/application", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/application")>()),
  emitirDocumentosOrden: () => async (ordenId: number) => void st.documentos.push(ordenId)
}));

const bearer = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 6, rol: "comprador" }, SECRET)}` });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { pagoRoutes } = await import("./index.js");
  const { comunaRoutes } = await import("../comunas/index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  pasarela = new PasarelaEnMemoria();
  app.decorate("pasarelaPago", pasarela);
  app.decorate("publicBaseUrl", "http://api.test");
  app.decorate("ecommerceUrl", "http://shop.test/");
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_r, cuerpo, listo) => {
    listo(null, Object.fromEntries(new URLSearchParams(cuerpo as string)));
  });
  [...pagoRoutes, ...comunaRoutes].forEach((r) => app.route(r));
});

beforeEach(() => {
  st.orden = ordenInicial();
  st.documentos = [];
});

describe("rutas de pago (KAN-95)", () => {
  it("POST /ordenes/:id/pago exige sesion e inicia la transaccion con el retorno publico del backend", async () => {
    expect((await app.inject({ method: "POST", url: "/ordenes/12/pago" })).statusCode).toBe(401);
    const r = await app.inject({ method: "POST", url: "/ordenes/12/pago", headers: bearer("8"), payload: { medioPago: "tarjeta" } });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ ordenId: 12, codigo: "CM-90012", total: 80150, urlPago: "https://pasarela.test/pagar" });
    expect(pasarela.solicitudes.at(-1)).toMatchObject({ monto: 80150, urlRetorno: "http://api.test/pagos/webpay/retorno" });
  });

  it("el retorno de Webpay por POST (formulario) confirma, emite documentos y redirige al resultado en el ecommerce", async () => {
    await app.inject({ method: "POST", url: "/ordenes/12/pago", headers: bearer("8"), payload: {} });
    const token = String(st.orden!.referenciaPasarela);
    const r = await app.inject({
      method: "POST",
      url: "/pagos/webpay/retorno",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `token_ws=${token}`
    });
    expect(r.statusCode).toBe(303);
    expect(r.headers.location).toBe("http://shop.test/checkout/resultado?orden=12&pago=aprobado");
    expect(st.orden).toMatchObject({ estado: "pagada", estadoPago: "pagado" });
    expect(st.documentos).toEqual([12]);
  });

  it("el retorno por GET con TBK_TOKEN (anulado) redirige con pago=anulado; sin datos vuelve al carro", async () => {
    await app.inject({ method: "POST", url: "/ordenes/12/pago", headers: bearer("8"), payload: {} });
    const token = String(st.orden!.referenciaPasarela);
    const anulado = await app.inject({ method: "GET", url: `/pagos/webpay/retorno?TBK_TOKEN=${token}&TBK_ID_SESION=orden-12&TBK_ORDEN_COMPRA=CM-90012` });
    expect(anulado.headers.location).toBe("http://shop.test/checkout/resultado?orden=12&pago=anulado");
    expect(st.orden!.estadoPago).toBe("fallido");
    const vacio = await app.inject({ method: "GET", url: "/pagos/webpay/retorno" });
    expect(vacio.headers.location).toBe("http://shop.test/carro?pago=anulado");
  });

  it("GET /comunas es publico", async () => {
    const r = await app.inject({ method: "GET", url: "/comunas" });
    expect(r.statusCode).toBe(200);
    expect(r.json()[0]).toMatchObject({ nombre: "Ñuñoa", regionCodigo: "13" });
  });
});

describe("retorno de PayPal (KAN-148)", () => {
  it("traduce el retorno de PayPal a la forma de Webpay", async () => {
    const { datosRetornoPayPal } = await import("./index.js");
    expect(datosRetornoPayPal({ token: "ABC", PayerID: "P", resultado: "ok" })).toEqual({ token_ws: "ABC" });
    expect(datosRetornoPayPal({ token: "ABC", resultado: "cancelado" })).toEqual({ TBK_TOKEN: "ABC" });
    expect(datosRetornoPayPal({})).toEqual({});
    expect(datosRetornoPayPal(undefined)).toEqual({});
  });
});
