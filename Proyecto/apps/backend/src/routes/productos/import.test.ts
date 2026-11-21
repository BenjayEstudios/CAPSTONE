import Fastify from "fastify";
import multipart from "@fastify/multipart";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
const usuarios: Record<number, Record<string, string>> = {
  1: { crear_producto: "total" },
  4: { crear_producto: "ninguno" }
};

// Productos "en BD": solo ARR-001 existe.
const bd = {
  productos: [{ id: 10, sku: "ARR-001", ean: null, nombre: "Arroz", categoriaId: 2, unidad: "kg", estado: "borrador",
    marca: null, formato: null, contenido: null, descripcion: null, precioReferencia: null, topeSobreReferenciaPct: null, imagenes: [] }],
  creados: [] as unknown[],
  actualizados: [] as unknown[]
};

vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const p = usuarios[id];
      return p ? { usuario: { id, estado: "activo" }, rol: { permisos: p }, organizacion: {} } : null;
    }
  },
  DrizzleCategoriaRepository: class {
    async listar() {
      return [
        { id: 1, padreId: null, nombre: "Alimentos", slug: "alimentos", orden: 1, estado: "activa" },
        { id: 2, padreId: 1, nombre: "Secos", slug: "secos", orden: 1, estado: "activa" }
      ];
    }
    async buscarPorId(id: number) {
      return (await this.listar()).find((c) => c.id === id) ?? null;
    }
  },
  DrizzleProductoRepository: class {
    async buscarPorSku(sku: string) {
      return bd.productos.find((p) => p.sku === sku) ?? null;
    }
    async listarTodos() {
      return bd.productos;
    }
    async buscarPorEan() {
      return null;
    }
    async buscarPorId(id: number) {
      return bd.productos.find((p) => p.id === id) ?? null;
    }
    async crear(input: Record<string, unknown>) {
      bd.creados.push(input);
      return { id: 99, ...input };
    }
    async actualizar(id: number, cambios: unknown) {
      bd.actualizados.push({ id, cambios });
      return { id };
    }
  }
}));

let app: FastifyInstance;
const auth = (sub = "1") => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

async function xlsx(filas: unknown[][], encabezados: string[] = ["SKU", "Nombre", "Categoria", "Unidad", "Marca"]) {
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet("Productos");
  hoja.addRow(encabezados);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function formulario(nombre: string, contenido: Buffer) {
  const limite = "----qatest";
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    contenido,
    Buffer.from(`\r\n--${limite}--\r\n`)
  ]);
  return { payload: cuerpo, headers: { "content-type": `multipart/form-data; boundary=${limite}` } };
}

const importar = (f: ReturnType<typeof formulario>, query = "", sub = "1") =>
  app.inject({ method: "POST", url: `/productos/importar${query}`, payload: f.payload, headers: { ...f.headers, ...auth(sub) } });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { productoRoutes } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorate("db", {} as never);
  await app.register(multipart, { limits: { fileSize: 1024 * 1024, files: 1 } });
  productoRoutes.forEach((r) => app.route(r));
});

beforeEach(() => {
  bd.creados.length = 0;
  bd.actualizados.length = 0;
});

describe("POST /productos/importar", () => {
  it("sin token -> 401; sin permiso -> 403", async () => {
    const f = formulario("a.xlsx", await xlsx([]));
    const sinToken = await app.inject({ method: "POST", url: "/productos/importar", payload: f.payload, headers: f.headers });
    expect(sinToken.statusCode).toBe(401);
    expect((await importar(f, "", "4")).statusCode).toBe(403);
  });

  it("por defecto simula: no escribe y reporta crear/actualizar/errores por fila", async () => {
    const archivo = await xlsx([
      ["arr-001", "Arroz premium", "", "", ""],
      ["FID-001", "Fideos", "Alimentos > Secos", "kg", "Carozzi"],
      ["MAL-001", "Sin categoria", "Nada", "kg", ""]
    ]);
    const res = await importar(formulario("p.xlsx", archivo));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ simulacion: true, totalFilas: 3, resumen: { crear: 1, actualizar: 1, errores: 1 } });
    expect(body.filas.map((f: { fila: number; accion: string }) => [f.fila, f.accion])).toEqual([[2, "actualizar"], [3, "crear"], [4, "error"]]);
    expect(bd.creados).toHaveLength(0);
    expect(bd.actualizados).toHaveLength(0);
  });

  it("simular=false aplica creaciones y actualizaciones", async () => {
    const archivo = await xlsx([
      ["ARR-001", "Arroz premium", "", "", ""],
      ["FID-001", "Fideos", "Alimentos > Secos", "kg", "Carozzi"]
    ]);
    const res = await importar(formulario("p.xlsx", archivo), "?simular=false");
    expect(res.json()).toMatchObject({ simulacion: false, resumen: { crear: 1, actualizar: 1, errores: 0 } });
    expect(bd.creados).toHaveLength(1);
    expect(bd.creados[0]).toMatchObject({ sku: "FID-001", categoriaId: 2, marca: "Carozzi", creadoPor: 1 });
    expect(bd.actualizados).toEqual([{ id: 10, cambios: { nombre: "Arroz premium" } }]);
  });

  it("reconoce encabezados con tildes/alias y salta filas vacias", async () => {
    const archivo = await xlsx([[null, null, null], ["FID-002", "Fideos", "Alimentos > Secos"]], ["sku", "NOMBRE", "Categoría"]);
    const res = await importar(formulario("p.xlsx", archivo));
    expect(res.json().filas).toHaveLength(1);
    expect(res.json().filas[0]).toMatchObject({ fila: 3, sku: "FID-002", accion: "error" }); // falta unidad
  });

  it("sin columna SKU -> 400 PLANTILLA_INVALIDA", async () => {
    const res = await importar(formulario("p.xlsx", await xlsx([["x"]], ["Nombre"])));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PLANTILLA_INVALIDA");
  });

  it("planilla sin filas -> 400 ARCHIVO_VACIO", async () => {
    const res = await importar(formulario("p.xlsx", await xlsx([])));
    expect(res.json().error.code).toBe("ARCHIVO_VACIO");
  });

  it("archivo que no es xlsx -> 400 ARCHIVO_INVALIDO", async () => {
    expect((await importar(formulario("p.csv", Buffer.from("sku,nombre")))).json().error.code).toBe("ARCHIVO_INVALIDO");
    expect((await importar(formulario("falso.xlsx", Buffer.from("sku,nombre")))).json().error.code).toBe("ARCHIVO_INVALIDO");
  });

  it("sin archivo -> 400", async () => {
    const limite = "----qatest";
    const res = await app.inject({
      method: "POST",
      url: "/productos/importar",
      payload: `--${limite}--\r\n`,
      headers: { "content-type": `multipart/form-data; boundary=${limite}`, ...auth() }
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /productos/plantilla-importacion", () => {
  it("descarga un xlsx con las hojas Productos, Instrucciones y Categorias", async () => {
    const res = await app.inject({ method: "GET", url: "/productos/plantilla-importacion", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain("attachment");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.rawPayload as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((h) => h.name)).toEqual(["Productos", "Instrucciones", "Categorias"]);
    expect(wb.getWorksheet("Categorias")?.getRow(3).getCell(2).value).toBe("Alimentos > Secos");
  });

  it("conProductos=true trae el catalogo actual y al subirlo sin tocar nada todo queda sin cambios", async () => {
    bd.productos[0].marca = "Tucapel" as never;
    const res = await app.inject({ method: "GET", url: "/productos/plantilla-importacion?conProductos=true", headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toContain("catalogo-maestro-actual.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.rawPayload as unknown as ExcelJS.Buffer);
    const fila = wb.getWorksheet("Productos")!.getRow(2);
    expect([fila.getCell(1).value, fila.getCell(3).value, fila.getCell(4).value, fila.getCell(5).value])
      .toEqual(["ARR-001", "Alimentos > Secos", "kg", "Tucapel"]);

    const r = await importar(formulario("catalogo.xlsx", res.rawPayload));
    expect(r.json()).toMatchObject({ simulacion: true, resumen: { crear: 0, actualizar: 0, sinCambios: 1, errores: 0 } });
    bd.productos[0].marca = null as never;
  });

  it("la plantilla vacia, tal cual, se rechaza como vacia (no importa filas de ejemplo)", async () => {
    const plantilla = await app.inject({ method: "GET", url: "/productos/plantilla-importacion", headers: auth() });
    const res = await importar(formulario("plantilla.xlsx", plantilla.rawPayload));
    expect(res.json().error.code).toBe("ARCHIVO_VACIO");
  });

  it("sin permiso -> 403", async () => {
    expect((await app.inject({ method: "GET", url: "/productos/plantilla-importacion", headers: auth("4") })).statusCode).toBe(403);
  });
});
