import { describe, expect, it } from "vitest";
import type { Categoria, NuevoProducto, Producto, ProductoRepository } from "@cotizapp/domain";
import { actualizarProducto } from "./actualizar-producto.use-case.js";
import { crearProducto } from "./crear-producto.use-case.js";
import { listarProductos } from "./listar-productos.use-case.js";
import { obtenerProducto } from "./obtener-producto.use-case.js";
import { reemplazarImagenesProducto } from "./reemplazar-imagenes-producto.use-case.js";
import { categoriaRepoEnMemoria } from "./categoria.use-cases.test.js";

function productoRepoEnMemoria(inicial: Producto[] = []) {
  const datos = [...inicial];
  let seq = Math.max(0, ...datos.map((p) => p.id));
  const repo: ProductoRepository & { datos: Producto[]; ultimosFiltros?: unknown } = {
    datos,
    listar: async (f) => {
      repo.ultimosFiltros = f;
      return { items: [], total: 0 };
    },
    buscarPorId: async (id) => datos.find((p) => p.id === id) ?? null,
    buscarPorSku: async (sku) => datos.find((p) => p.sku === sku) ?? null,
    buscarPorEan: async (ean) => datos.find((p) => p.ean === ean) ?? null,
    resumenOfertas: async () => ({ proveedoresConOfertaActiva: 2, precioDesde: 990 }),
    crear: async (i: NuevoProducto) => {
      const p: Producto = {
        id: ++seq, categoriaId: i.categoriaId, sku: i.sku, ean: i.ean ?? null, nombre: i.nombre,
        marca: i.marca ?? null, formato: i.formato ?? null, contenido: i.contenido ?? null, unidad: i.unidad,
        descripcion: i.descripcion ?? null, precioReferencia: i.precioReferencia ?? null,
        topeSobreReferenciaPct: i.topeSobreReferenciaPct ?? null, imagenes: [], estado: i.estado,
        creadoPor: i.creadoPor, creadoEn: new Date()
      };
      datos.push(p);
      return p;
    },
    actualizar: async (id, cambios) => {
      const p = datos.find((x) => x.id === id)!;
      Object.assign(p, cambios);
      return { ...p };
    }
  };
  return repo;
}

const categorias: Categoria[] = [
  { id: 1, padreId: null, nombre: "Alimentos", slug: "alimentos", orden: 1, estado: "activa" },
  { id: 2, padreId: 1, nombre: "Secos", slug: "secos", orden: 1, estado: "activa" }
];

const base = { nombre: "Arroz grado 1", sku: "arr-001", categoriaId: 2, unidad: "kg" as const };
const img = (url: string, esPrincipal = false) => ({ url: `https://cdn.test/${url}.jpg`, esPrincipal });

function deps(productos: Producto[] = []) {
  const productoRepository = productoRepoEnMemoria(productos);
  const categoriaRepository = categoriaRepoEnMemoria(categorias);
  return { productoRepository, categoriaRepository };
}

describe("crearProducto", () => {
  it("crea borrador, normaliza SKU a mayusculas", async () => {
    const d = deps();
    const p = await crearProducto(d)({ ...base, precioReferencia: 1000 }, 7);
    expect(p).toMatchObject({ sku: "ARR-001", estado: "borrador", creadoPor: 7 });
    expect(p.categoria).toMatchObject({ id: 2, padre: { id: 1 } });
  });
  it("SKU duplicado -> 409", async () => {
    const d = deps();
    await crearProducto(d)(base, 1);
    await expect(crearProducto(d)(base, 1)).rejects.toMatchObject({ statusCode: 409, code: "SKU_DUPLICADO" });
  });
  it("EAN duplicado -> 409", async () => {
    const d = deps();
    await crearProducto(d)({ ...base, ean: "7801234567890" }, 1);
    await expect(crearProducto(d)({ ...base, sku: "otro", ean: "7801234567890" }, 1))
      .rejects.toMatchObject({ statusCode: 409, code: "EAN_DUPLICADO" });
  });
  it("categoria inexistente -> 400", async () => {
    await expect(crearProducto(deps())({ ...base, categoriaId: 99 }, 1))
      .rejects.toMatchObject({ statusCode: 400, code: "CATEGORIA_NO_EXISTE" });
  });
  it("tope sin precio de referencia -> 400 PRECIO_INCOHERENTE", async () => {
    await expect(crearProducto(deps())({ ...base, topeSobreReferenciaPct: 10 }, 1))
      .rejects.toMatchObject({ code: "PRECIO_INCOHERENTE" });
  });
  it("body invalido -> 400 VALIDACION", async () => {
    await expect(crearProducto(deps())({ nombre: "", sku: "a b", unidad: "caja" }, 1))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
  });
  it("crear directamente como publicado falla (sin imagen)", async () => {
    await expect(crearProducto(deps())({ ...base, precioReferencia: 1000, estado: "publicado" }, 1))
      .rejects.toMatchObject({ code: "PUBLICACION_INCOMPLETA" });
  });
});

describe("actualizarProducto / publicar", () => {
  async function conBorrador(extra: Record<string, unknown> = {}) {
    const d = deps();
    const p = await crearProducto(d)({ ...base, ...extra }, 1);
    return { d, id: p.id };
  }

  it("publicar sin precio ni imagen -> 400 listando lo que falta", async () => {
    const { d, id } = await conBorrador();
    const err = await actualizarProducto(d)(id, { estado: "publicado" }).catch((e) => e);
    expect(err).toMatchObject({ statusCode: 400, code: "PUBLICACION_INCOMPLETA" });
    expect(err.message).toContain("precio de referencia");
    expect(err.message).toContain("imagen principal");
  });
  it("publicar con requisitos completos", async () => {
    const { d, id } = await conBorrador({ precioReferencia: 1500 });
    await reemplazarImagenesProducto(d)(id, { imagenes: [img("a", true)] }, 1);
    const p = await actualizarProducto(d)(id, { estado: "publicado" });
    expect(p.estado).toBe("publicado");
  });
  it("un publicado no puede quedarse sin precio de referencia", async () => {
    const { d, id } = await conBorrador({ precioReferencia: 1500 });
    await reemplazarImagenesProducto(d)(id, { imagenes: [img("a", true)] }, 1);
    await actualizarProducto(d)(id, { estado: "publicado" });
    await expect(actualizarProducto(d)(id, { precioReferencia: null })).rejects.toMatchObject({ code: "PUBLICACION_INCOMPLETA" });
  });
  it("SKU de otro producto -> 409; el propio SKU no", async () => {
    const { d, id } = await conBorrador();
    await crearProducto(d)({ ...base, sku: "otro" }, 1);
    await expect(actualizarProducto(d)(id, { sku: "otro" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(actualizarProducto(d)(id, { sku: "arr-001", nombre: "Arroz 2" })).resolves.toMatchObject({ nombre: "Arroz 2" });
  });
  it("no existe -> 404; categoria inexistente -> 400", async () => {
    const { d, id } = await conBorrador();
    await expect(actualizarProducto(d)(999, { nombre: "x" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(actualizarProducto(d)(id, { categoriaId: 55 })).rejects.toMatchObject({ code: "CATEGORIA_NO_EXISTE" });
  });
});

describe("reemplazarImagenesProducto", () => {
  async function conBorrador() {
    const d = deps();
    const p = await crearProducto(d)({ ...base, precioReferencia: 1000 }, 1);
    return { d, id: p.id };
  }
  it("exactamente una principal", async () => {
    const { d, id } = await conBorrador();
    const uc = reemplazarImagenesProducto(d);
    await expect(uc(id, { imagenes: [img("a"), img("b")] }, 1)).rejects.toMatchObject({ code: "IMAGEN_PRINCIPAL_REQUERIDA" });
    await expect(uc(id, { imagenes: [img("a", true), img("b", true)] }, 1)).rejects.toMatchObject({ code: "IMAGEN_PRINCIPAL_MULTIPLE" });
    const r = await uc(id, { imagenes: [img("a"), img("b", true)] }, 3);
    expect(r.map((i) => [i.orden, i.esPrincipal, i.subidaPor])).toEqual([[0, false, 3], [1, true, 3]]);
  });
  it("ancho < 1200 -> 400; >= 1200 ok", async () => {
    const { d, id } = await conBorrador();
    const uc = reemplazarImagenesProducto(d);
    await expect(uc(id, { imagenes: [{ ...img("a", true), ancho: 800 }] }, 1)).rejects.toMatchObject({ code: "VALIDACION" });
    const r = await uc(id, { imagenes: [{ ...img("a", true), ancho: 1200, alto: 900 }] }, 1);
    expect(r[0]).toMatchObject({ ancho: 1200, alto: 900 });
  });
  it("lista vacia ok en borrador, no en publicado; producto inexistente 404", async () => {
    const { d, id } = await conBorrador();
    const uc = reemplazarImagenesProducto(d);
    await expect(uc(id, { imagenes: [] }, 1)).resolves.toEqual([]);
    await uc(id, { imagenes: [img("a", true)] }, 1);
    await actualizarProducto(d)(id, { estado: "publicado" });
    await expect(uc(id, { imagenes: [] }, 1)).rejects.toMatchObject({ code: "PUBLICACION_INCOMPLETA" });
    await expect(uc(404, { imagenes: [] }, 1)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("conserva subidaEn/subidaPor de una url ya registrada", async () => {
    const { d, id } = await conBorrador();
    const t1 = reemplazarImagenesProducto({ ...d, ahora: () => new Date("2026-01-01T00:00:00Z") });
    await t1(id, { imagenes: [img("a", true)] }, 1);
    const t2 = reemplazarImagenesProducto({ ...d, ahora: () => new Date("2026-02-02T00:00:00Z") });
    const r = await t2(id, { imagenes: [img("a", true), img("b")] }, 9);
    expect(r[0]).toMatchObject({ subidaPor: 1, subidaEn: "2026-01-01T00:00:00.000Z" });
    expect(r[1]).toMatchObject({ subidaPor: 9 });
  });
});

describe("listar / obtener", () => {
  it("filtro por categoria padre incluye hijas; paginacion por defecto", async () => {
    const d = deps();
    const r = await listarProductos(d)({ categoriaId: "1", q: "arroz" });
    expect(d.productoRepository.ultimosFiltros).toMatchObject({ categoriaIds: [1, 2], q: "arroz", pagina: 1, tamano: 20 });
    expect(r).toMatchObject({ total: 0, totalPaginas: 1 });
  });
  it("query invalida -> 400; ficha inexistente -> 404; ficha trae resumen de ofertas", async () => {
    const d = deps();
    await expect(listarProductos(d)({ estado: "x" })).rejects.toMatchObject({ code: "VALIDACION" });
    await expect(obtenerProducto(d)(5)).rejects.toMatchObject({ statusCode: 404 });
    const p = await crearProducto(d)(base, 1);
    expect(await obtenerProducto(d)(p.id)).toMatchObject({ proveedoresConOfertaActiva: 2, precioDesde: 990 });
  });
});
