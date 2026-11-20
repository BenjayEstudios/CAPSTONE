import Fastify from "fastify";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Rutas publicas del catalogo (KAN-145) con repositorios en memoria.
const SECRET = "secreto-solo-para-test";
const zonasPedidas: number[] = [];
const fichaBase = {
  id: 1, sku: "ACE-0001", nombre: "Aceite", marca: null, formato: null, contenido: 5, unidad: "L", categoriaId: 8,
  imagenUrl: null, descripcion: null, precioReferencia: null,
  categoria: { id: 8, nombre: "Aceites", padre: null }, ofertas: []
};

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleCatalogoRepository: class {
    async listar() { return { items: [{ id: 1 }], total: 1 }; }
    async obtenerFicha(id: number) { return id === 1 ? fichaBase : null; }
    async zonaDeOrganizacion(id: number) { zonasPedidas.push(id); return null; }
    async resumen() { return { proveedoresActivos: 3, productosPorCategoria: [] }; }
  },
  DrizzleCategoriaRepository: class { async listar() { return []; } },
  DrizzleCalificacionRepository: class { async resumenPorProveedor() { return []; } }
}));

let app: FastifyInstance;
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { catalogoRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.decorate("db", {} as never);
  app.setErrorHandler(errorHandler);
  catalogoRoutes.forEach((r) => app.route(r));
});

const get = (url: string, token?: string) =>
  app.inject({ method: "GET", url, headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("catalogo publico", () => {
  it("listado y ficha sin token", async () => {
    const l = await get("/catalogo/productos?q=aceite&orden=precio");
    expect(l.statusCode).toBe(200);
    expect(l.json()).toMatchObject({ total: 1, pagina: 1, porPagina: 20 });
    expect((await get("/catalogo/productos/1")).statusCode).toBe(200);
  });

  it("resumen publico para el inicio (la ruta estatica no choca con /:id)", async () => {
    const r = await get("/catalogo/resumen");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ proveedoresActivos: 3, productosComparados: 0, categorias: [] });
  });

  it("con sesion usa la organizacion del token; un token invalido no bloquea", async () => {
    zonasPedidas.length = 0;
    const token = jwt.sign({ sub: "8", organizacionId: 6, rol: "comprador" }, SECRET);
    expect((await get("/catalogo/productos/1", token)).statusCode).toBe(200);
    expect(zonasPedidas).toEqual([6]);
    expect((await get("/catalogo/productos/1", "basura")).statusCode).toBe(200);
    expect(zonasPedidas).toEqual([6]);
  });

  it("404 PRODUCTO_NO_ENCONTRADO y 400 por parametros invalidos", async () => {
    const r = await get("/catalogo/productos/99");
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe("PRODUCTO_NO_ENCONTRADO");
    expect((await get("/catalogo/productos/abc")).statusCode).toBe(400);
    expect((await get("/catalogo/productos?orden=raro")).statusCode).toBe(400);
  });
});
