import { describe, expect, it } from "vitest";
import type { ActualizarCategoriaDto, Categoria, CategoriaRepository, CrearCategoriaDto } from "@cotizapp/domain";
import { actualizarCategoria } from "./actualizar-categoria.use-case.js";
import { crearCategoria } from "./crear-categoria.use-case.js";
import { listarCategorias } from "./listar-categorias.use-case.js";

export function categoriaRepoEnMemoria(inicial: Categoria[] = []): CategoriaRepository & { datos: Categoria[] } {
  const datos = [...inicial];
  let seq = Math.max(0, ...datos.map((c) => c.id));
  return {
    datos,
    listar: async () => [...datos],
    buscarPorId: async (id) => datos.find((c) => c.id === id) ?? null,
    buscarPorSlug: async (slug) => datos.find((c) => c.slug === slug) ?? null,
    contarHijos: async (id) => datos.filter((c) => c.padreId === id).length,
    crear: async (i: CrearCategoriaDto) => {
      const c: Categoria = {
        id: ++seq, padreId: i.padreId ?? null, nombre: i.nombre, slug: i.slug, orden: i.orden ?? null, estado: "activa"
      };
      datos.push(c);
      return c;
    },
    actualizar: async (id, cambios: ActualizarCategoriaDto) => {
      const c = datos.find((x) => x.id === id)!;
      Object.assign(c, cambios);
      return { ...c };
    }
  };
}

const cat = (id: number, o: Partial<Categoria> = {}): Categoria => ({
  id, padreId: null, nombre: `Cat ${id}`, slug: `cat-${id}`, orden: id, estado: "activa", ...o
});

describe("crearCategoria", () => {
  it("slug duplicado -> 409 SLUG_DUPLICADO", async () => {
    const repo = categoriaRepoEnMemoria([cat(1)]);
    await expect(crearCategoria({ categoriaRepository: repo })({ nombre: "X", slug: "cat-1" }))
      .rejects.toMatchObject({ statusCode: 409, code: "SLUG_DUPLICADO" });
  });
  it("body invalido -> 400 VALIDACION", async () => {
    const repo = categoriaRepoEnMemoria();
    await expect(crearCategoria({ categoriaRepository: repo })({ nombre: "", slug: "Mal Slug" }))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
  });
  it("padre que ya es hijo -> 400 ARBOL_MAXIMO_2_NIVELES", async () => {
    const repo = categoriaRepoEnMemoria([cat(1), cat(2, { padreId: 1 })]);
    await expect(crearCategoria({ categoriaRepository: repo })({ nombre: "Nieta", slug: "nieta", padreId: 2 }))
      .rejects.toMatchObject({ statusCode: 400, code: "ARBOL_MAXIMO_2_NIVELES" });
  });
  it("padre inexistente -> 400", async () => {
    const repo = categoriaRepoEnMemoria();
    await expect(crearCategoria({ categoriaRepository: repo })({ nombre: "H", slug: "h", padreId: 9 }))
      .rejects.toMatchObject({ statusCode: 400, code: "CATEGORIA_PADRE_NO_EXISTE" });
  });
  it("crea hija de una raiz", async () => {
    const repo = categoriaRepoEnMemoria([cat(1)]);
    const c = await crearCategoria({ categoriaRepository: repo })({ nombre: "Hija", slug: "hija", padreId: 1 });
    expect(c.padreId).toBe(1);
  });
});

describe("actualizarCategoria", () => {
  it("no existe -> 404", async () => {
    const repo = categoriaRepoEnMemoria();
    await expect(actualizarCategoria({ categoriaRepository: repo })(5, { nombre: "x" }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
  it("slug de otra categoria -> 409; el propio slug no choca", async () => {
    const repo = categoriaRepoEnMemoria([cat(1), cat(2)]);
    const uc = actualizarCategoria({ categoriaRepository: repo });
    await expect(uc(2, { slug: "cat-1" })).rejects.toMatchObject({ statusCode: 409, code: "SLUG_DUPLICADO" });
    await expect(uc(2, { slug: "cat-2", nombre: "Nuevo" })).resolves.toMatchObject({ nombre: "Nuevo" });
  });
  it("una categoria con hijos no puede pasar a ser hija", async () => {
    const repo = categoriaRepoEnMemoria([cat(1), cat(2), cat(3, { padreId: 1 })]);
    await expect(actualizarCategoria({ categoriaRepository: repo })(1, { padreId: 2 }))
      .rejects.toMatchObject({ statusCode: 400, code: "ARBOL_MAXIMO_2_NIVELES" });
  });
  it("no puede ser su propio padre ni colgar de una hija", async () => {
    const repo = categoriaRepoEnMemoria([cat(1), cat(2, { padreId: 1 }), cat(3)]);
    const uc = actualizarCategoria({ categoriaRepository: repo });
    await expect(uc(3, { padreId: 3 })).rejects.toMatchObject({ code: "CATEGORIA_PADRE_INVALIDO" });
    await expect(uc(3, { padreId: 2 })).rejects.toMatchObject({ code: "ARBOL_MAXIMO_2_NIVELES" });
  });
  it("oculta, reordena y mueve a raiz", async () => {
    const repo = categoriaRepoEnMemoria([cat(1), cat(2, { padreId: 1 })]);
    const uc = actualizarCategoria({ categoriaRepository: repo });
    expect(await uc(2, { estado: "oculta", orden: 7 })).toMatchObject({ estado: "oculta", orden: 7 });
    expect(await uc(2, { padreId: null })).toMatchObject({ padreId: null });
  });
  it("body vacio o estado invalido -> 400", async () => {
    const repo = categoriaRepoEnMemoria([cat(1)]);
    const uc = actualizarCategoria({ categoriaRepository: repo });
    await expect(uc(1, {})).rejects.toMatchObject({ code: "VALIDACION" });
    await expect(uc(1, { estado: "borrada" })).rejects.toMatchObject({ code: "VALIDACION" });
  });
});

describe("listarCategorias", () => {
  const datos = [
    cat(1, { orden: 2 }), cat(2, { orden: 1, estado: "oculta" }), cat(3, { padreId: 1, orden: 2 }),
    cat(4, { padreId: 1, orden: 1 }), cat(5, { padreId: 2 }), cat(6, { padreId: 1, estado: "oculta" })
  ];
  it("publico: solo activas, sin hijas de padre oculto, ordenadas", async () => {
    const r = (await listarCategorias({ categoriaRepository: categoriaRepoEnMemoria(datos) })()) as Categoria[];
    expect(r.map((c) => c.id)).toEqual([1, 4, 3]);
  });
  it("admin incluirOcultas: todas", async () => {
    const r = (await listarCategorias({ categoriaRepository: categoriaRepoEnMemoria(datos) })({ incluirOcultas: true })) as Categoria[];
    expect(r.map((c) => c.id)).toEqual([2, 5, 1, 4, 3, 6]);
  });
  it("arbol", async () => {
    const r = (await listarCategorias({ categoriaRepository: categoriaRepoEnMemoria(datos) })({ arbol: true })) as Array<
      Categoria & { hijos: Categoria[] }
    >;
    expect(r).toHaveLength(1);
    expect(r[0].hijos.map((h) => h.id)).toEqual([4, 3]);
  });
});
