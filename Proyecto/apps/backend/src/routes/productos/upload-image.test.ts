import Fastify from "fastify";
import multipart from "@fastify/multipart";
import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

const SECRET = "secreto-solo-para-test";
const usuarios: Record<number, Record<string, string>> = {
  1: { cargar_imagenes: "total" },
  3: { cargar_imagenes: "parcial" },
  4: { cargar_imagenes: "ninguno" }
};
vi.mock("@cotizapp/infrastructure", async (orig) => ({
  ...(await orig<typeof import("@cotizapp/infrastructure")>()),
  DrizzleUsuarioRepository: class {
    async buscarPorId(id: number) {
      const p = usuarios[id];
      return p ? { usuario: { id, estado: "activo" }, rol: { permisos: p }, organizacion: {} } : null;
    }
  },
  DrizzleProductoRepository: class {
    async buscarPorId(id: number) {
      return id === 1 ? { id } : null;
    }
  }
}));

const guardados: Array<{ nombre: string; mime: string; bytes: number }> = [];
let app: FastifyInstance;
const auth = (sub = "1") => ({ authorization: `Bearer ${jwt.sign({ sub, organizacionId: 1, rol: "x" }, SECRET)}` });

// PNG minimo valido en cabecera (firma + IHDR) con el ancho/alto pedidos.
function png(ancho: number, alto: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(ancho, 16);
  b.writeUInt32BE(alto, 20);
  b[24] = 8;
  b[25] = 2;
  return b;
}

function formulario(nombre: string, contenido: Buffer, mime = "image/png") {
  const limite = "----qatest";
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: ${mime}\r\n\r\n`),
    contenido,
    Buffer.from(`\r\n--${limite}--\r\n`)
  ]);
  return { payload: cuerpo, headers: { "content-type": `multipart/form-data; boundary=${limite}` } };
}

const subir = (id: number, f: ReturnType<typeof formulario>, sub = "1") =>
  app.inject({ method: "POST", url: `/productos/${id}/imagenes/archivo`, payload: f.payload, headers: { ...f.headers, ...auth(sub) } });

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", SECRET);
  const { uploadImagenProductoRoute } = await import("./upload-image.js");
  const { errorHandler } = await import("../../lib/error-handler.js");
  app = Fastify();
  app.setErrorHandler(errorHandler);
  app.decorate("uploadsMaxBytes", 1024 * 1024);
  app.decorate("almacenArchivos", {
    guardar: async (c: Uint8Array, nombre: string, mime: string) => {
      guardados.push({ nombre, mime, bytes: c.length });
      return { url: `http://localhost/uploads/${nombre}`, clave: nombre };
    },
    eliminar: async () => {}
  });
  await app.register(multipart, { limits: { fileSize: 1024 * 1024, files: 1 } });
  app.route(uploadImagenProductoRoute);
});

describe("POST /productos/:id/imagenes/archivo", () => {
  it("sin token -> 401", async () => {
    const f = formulario("a.png", png(1200, 800));
    const res = await app.inject({ method: "POST", url: "/productos/1/imagenes/archivo", payload: f.payload, headers: f.headers });
    expect(res.statusCode).toBe(401);
  });
  it("sin permiso (parcial / ninguno) -> 403", async () => {
    const f = formulario("a.png", png(1200, 800));
    expect((await subir(1, f, "3")).statusCode).toBe(403);
    expect((await subir(1, f, "4")).statusCode).toBe(403);
  });
  it("archivo .png con texto -> 400 FORMATO_NO_SOPORTADO", async () => {
    const res = await subir(1, formulario("falso.png", Buffer.from("hola, no soy una imagen")));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("FORMATO_NO_SOPORTADO");
  });
  it("tamano excedido -> 413", async () => {
    const grande = Buffer.concat([png(1200, 800), Buffer.alloc(2 * 1024 * 1024)]);
    const res = await subir(1, formulario("grande.png", grande));
    expect(res.statusCode).toBe(413);
  });
  it("ancho < 1200 -> 400 IMAGEN_MUY_PEQUENA", async () => {
    const res = await subir(1, formulario("chica.png", png(800, 600)));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("IMAGEN_MUY_PEQUENA");
  });
  it("producto inexistente -> 404", async () => {
    expect((await subir(2, formulario("a.png", png(1200, 800)))).statusCode).toBe(404);
  });
  it("sin archivo -> 400", async () => {
    const limite = "----qatest";
    const res = await app.inject({
      method: "POST",
      url: "/productos/1/imagenes/archivo",
      payload: `--${limite}--\r\n`,
      headers: { "content-type": `multipart/form-data; boundary=${limite}`, ...auth() }
    });
    expect(res.statusCode).toBe(400);
  });
  it("OK: nombre generado por el servidor, ignora el del cliente", async () => {
    const res = await subir(1, formulario("../../etc/pasaporte.jpg", png(1600, 900)));
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ ancho: 1600, alto: 900 });
    expect(body.clave).toMatch(/^productos\/1\/[0-9a-f-]{36}\.png$/);
    expect(body.url).toBe(`http://localhost/uploads/${body.clave}`);
    expect(guardados.at(-1)?.mime).toBe("image/png");
  });
});
