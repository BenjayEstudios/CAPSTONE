import Fastify from "fastify";
import multipart from "@fastify/multipart";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Documentos del proveedor (KAN-110): GET y POST multipart con mocks.
const SECRET = "secreto-solo-para-test";
const usuarios: Record<number, Record<string, string>> = {
  7: { publicar_precio_stock: "total", ver_ordenes_propias: "total" },
  5: { ver_ordenes_propias: "total" }
};
const creados: unknown[] = [];
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const p = usuarios[id];
      return p ? { usuario: { id, estado: "activo" }, rol: { permisos: p }, organizacion: { id: 2, tipo: "proveedor", estado: "activa" } } : null;
    }
  },
  DrizzleProveedorRepository: class {
    async listarDocumentos() {
      return [{ id: 1, proveedorId: 2, tipo: "carpeta_tributaria", url: "u", venceEn: null, vigencia: "al_dia", revisionEstado: "aprobado", motivoRechazo: null, revisadoPor: null, revisadoEn: null }];
    }
    async crearDocumento(proveedorId: number, d: { tipo: string; url: string; venceEn: string | null }) {
      creados.push({ proveedorId, ...d });
      return { id: 9, proveedorId, tipo: d.tipo, url: d.url, venceEn: d.venceEn, vigencia: "al_dia", revisionEstado: "pendiente", motivoRechazo: null, revisadoPor: null, revisadoEn: null };
    }
  }
}));

const guardados: Array<{ nombre: string; mime: string }> = [];
let app: FastifyInstance;
const auth = (sub: string) => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 2, rol: "x" }, SECRET)}` });
const PDF = Buffer.from("%PDF-1.4\n%prueba\n");

function formulario(contenido: Buffer, nombre = "doc.pdf", mime = "application/pdf") {
  const limite = "----kan110";
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: ${mime}\r\n\r\n`),
    contenido,
    Buffer.from(`\r\n--${limite}--\r\n`)
  ]);
  return { payload: cuerpo, headers: { "content-type": `multipart/form-data; boundary=${limite}` } };
}
const subir = (query: string, f = formulario(PDF), sub = "7") =>
  app.inject({ method: "POST", url: `/proveedor/documentos${query}`, payload: f.payload, headers: { ...f.headers, ...auth(sub) } });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { misDocumentosRoute, subirDocumentoRoute } = await import("./index.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorate("uploadsMaxBytes", 1024 * 1024);
  app.decorate("almacenArchivos", {
    guardar: async (_c: Uint8Array, nombre: string, mime: string) => {
      guardados.push({ nombre, mime });
      return { url: `http://localhost/uploads/${nombre}`, clave: nombre };
    },
    eliminar: async () => {}
  });
  await app.register(multipart, { limits: { fileSize: 1024 * 1024, files: 1 } });
  app.route(misDocumentosRoute);
  app.route(subirDocumentoRoute);
});

describe("documentos del proveedor (KAN-110)", () => {
  it("GET: sin token 401, sin permiso de proveedor 403, el proveedor ve los tres documentos", async () => {
    expect((await app.inject({ method: "GET", url: "/proveedor/documentos" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/proveedor/documentos", headers: auth("5") })).statusCode).toBe(403);
    const r = await app.inject({ method: "GET", url: "/proveedor/documentos", headers: auth("7") });
    expect(r.statusCode).toBe(200);
    expect(r.json().items.map((d: { tipo: string; estado: string }) => [d.tipo, d.estado])).toEqual([
      ["carpeta_tributaria", "al_dia"],
      ["resolucion_sanitaria", "falta"],
      ["vigencia", "falta"]
    ]);
  });

  it("POST: guarda el PDF con nombre del servidor y lo deja pendiente de revision", async () => {
    const r = await subir("?tipo=vigencia&venceEn=2099-01-31");
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ tipo: "vigencia", nombre: "Certificado de vigencia", revisionEstado: "pendiente", venceEn: "2099-01-31" });
    expect(guardados.at(-1)!.nombre).toMatch(/^proveedores\/2\/documentos\/vigencia-[0-9a-f-]+\.pdf$/);
    expect(guardados.at(-1)!.mime).toBe("application/pdf");
    expect(creados.at(-1)).toMatchObject({ proveedorId: 2, tipo: "vigencia", venceEn: "2099-01-31" });
  });

  it("POST: sin archivo, sin vencimiento, vencido, formato raro o tipo desconocido -> 400; cliente 403", async () => {
    const vacio = await app.inject({ method: "POST", url: "/proveedor/documentos?tipo=vigencia&venceEn=2099-01-31", headers: { "content-type": "multipart/form-data; boundary=x", ...auth("7") }, payload: "--x--\r\n" });
    expect(vacio.statusCode).toBe(400);
    expect((await subir("?tipo=resolucion_sanitaria")).json().error.code).toBe("VENCIMIENTO_REQUERIDO");
    expect((await subir("?tipo=vigencia&venceEn=2020-01-01")).json().error.code).toBe("DOCUMENTO_VENCIDO");
    expect((await subir("?tipo=carpeta_tributaria", formulario(Buffer.from("hola"), "a.txt", "text/plain"))).json().error.code).toBe("FORMATO_NO_SOPORTADO");
    expect((await subir("?tipo=otro")).statusCode).toBe(400);
    expect((await subir("?tipo=carpeta_tributaria", formulario(PDF), "5")).statusCode).toBe(403);
  });
});
