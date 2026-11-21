import { describe, expect, it } from "vitest";
import type { CalificacionRepository, CatalogoRepository, CategoriaRepository, FichaCatalogoBase, FiltrosCatalogo, ZonaComprador } from "@cotizapp/domain";
import { listarCatalogo, obtenerFichaCatalogo, precioNormalizado, resumenCatalogo, ZONA_POR_DEFECTO } from "./catalogo.use-cases.js";

const categorias = [
  { id: 1, padreId: null, nombre: "Abarrotes" },
  { id: 8, padreId: 1, nombre: "Aceites" },
  { id: 9, padreId: 1, nombre: "Arroz" },
  { id: 2, padreId: null, nombre: "Huevos" }
];
const categoriaRepository = { listar: async () => categorias } as unknown as CategoriaRepository;

const oferta = (id: number, precio: number, proveedorId: number) => ({
  id, precioUnitario: precio, unidadesPorCaja: 4, cajasDisponibles: 10, minimoCompra: 1, plazoHoras: 24,
  modalidadEntrega: "ambos" as const, notasCliente: null,
  proveedor: { id: proveedorId, nombre: `P${proveedorId}`, entregasATiempoPct: 95, despachoGratisDesde: 100000, costoDespacho: 4990 }
});
const ficha: FichaCatalogoBase = {
  id: 1, sku: "ACE-0001", nombre: "Aceite", marca: "Belmont", formato: "Bidon 5 L", contenido: 5, unidad: "L", categoriaId: 8,
  imagenUrl: null, descripcion: null, precioReferencia: 12990,
  categoria: { id: 8, nombre: "Aceites", padre: { id: 1, nombre: "Abarrotes" } },
  ofertas: [oferta(11, 12890, 3), oferta(10, 12490, 2)]
};

function montar(o: { zonaOrg?: ZonaComprador | null } = {}) {
  const llamadas: { filtros?: FiltrosCatalogo; zona?: ZonaComprador; zonaDe: number[] } = { zonaDe: [] };
  const catalogoRepository: CatalogoRepository = {
    listar: async (f) => {
      llamadas.filtros = f;
      return { items: [], total: 0 };
    },
    obtenerFicha: async (id, zona) => {
      llamadas.zona = zona;
      return id === 1 ? structuredClone(ficha) : null;
    },
    zonaDeOrganizacion: async (id) => {
      llamadas.zonaDe.push(id);
      return o.zonaOrg ?? null;
    }
  };
  const calificacionRepository = {
    resumenPorProveedor: async (ids?: number[]) =>
      [{ proveedorId: 2, promedio: 4.67, cantidad: 6 }].filter((r) => !ids || ids.includes(r.proveedorId))
  } as unknown as CalificacionRepository;
  return {
    llamadas,
    listar: listarCatalogo({ catalogoRepository, categoriaRepository }),
    ficha: obtenerFichaCatalogo({ catalogoRepository, calificacionRepository })
  };
}

describe("listarCatalogo", () => {
  it("defaults del contrato: relevancia, pagina 1, 20 por pagina", async () => {
    const m = montar();
    expect(await m.listar({})).toEqual({ items: [], total: 0, pagina: 1, porPagina: 20 });
    expect(m.llamadas.filtros).toMatchObject({ orden: "relevancia", pagina: 1, porPagina: 20, categoriaIds: undefined });
  });

  it("una categoria padre incluye sus subcategorias; una hoja solo a si misma", async () => {
    const m = montar();
    await m.listar({ categoriaId: "1" });
    expect(m.llamadas.filtros?.categoriaIds).toEqual([1, 8, 9]);
    await m.listar({ categoriaId: "9" });
    expect(m.llamadas.filtros?.categoriaIds).toEqual([9]);
  });

  it("KAN-90/91: minimo de compra, retiro y marca llegan al repositorio; conRetiro solo con 'true' o '1'", async () => {
    const m = montar();
    await m.listar({ maxMinimoCompra: "1", conRetiro: "true", marca: " Soprole " });
    expect(m.llamadas.filtros).toMatchObject({ maxMinimoCompra: 1, conRetiro: true, marca: "Soprole" });
    await m.listar({ conRetiro: "no" });
    expect(m.llamadas.filtros?.conRetiro).toBeUndefined();
  });

  it("convierte los query params y rechaza valores invalidos", async () => {
    const m = montar();
    await m.listar({ q: "  aceite ", plazoMaxHoras: "24", maxUnidadesPorCaja: "6", orden: "diferencia", porPagina: "5" });
    expect(m.llamadas.filtros).toMatchObject({ q: "aceite", plazoMaxHoras: 24, maxUnidadesPorCaja: 6, orden: "diferencia", porPagina: 5 });
    await expect(m.listar({ orden: "raro" })).rejects.toMatchObject({ statusCode: 400, code: "VALIDACION" });
    await expect(m.listar({ porPagina: "500" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("obtenerFichaCatalogo", () => {
  it("ordena por precio, agrega calificacion (o vacia) y precio por litro", async () => {
    const r = await montar().ficha(1, { origen: "catalogo" });
    expect(r.ofertas.map((o) => o.precioUnitario)).toEqual([12490, 12890]);
    expect(r.ofertas[0]!.proveedor.calificacion).toEqual({ promedio: 4.67, cantidad: 6 });
    expect(r.ofertas[1]!.proveedor.calificacion).toEqual({ promedio: null, cantidad: 0 });
    expect(r.ofertas[0]!.precioNormalizado).toEqual({ valor: 2498, por: "L" });
  });

  it("sin comprador usa la RM; con comprador, la zona de su organizacion (o la RM si no tiene direccion)", async () => {
    const sin = montar();
    await sin.ficha(1, {});
    expect(sin.llamadas.zona).toEqual(ZONA_POR_DEFECTO);
    expect(sin.llamadas.zonaDe).toEqual([]);

    const valpo = { regionCodigo: "05", comunaId: 40 };
    const con = montar({ zonaOrg: valpo });
    await con.ficha(1, {}, 6);
    expect(con.llamadas.zonaDe).toEqual([6]);
    expect(con.llamadas.zona).toEqual(valpo);

    const sinDireccion = montar({ zonaOrg: null });
    await sinDireccion.ficha(1, {}, 6);
    expect(sinDireccion.llamadas.zona).toEqual(ZONA_POR_DEFECTO);
  });

  it("producto inexistente o no publicado -> 404; origen invalido -> 400", async () => {
    await expect(montar().ficha(99, {})).rejects.toMatchObject({ statusCode: 404, code: "PRODUCTO_NO_ENCONTRADO" });
    await expect(montar().ficha(1, { origen: "otro" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("resumenCatalogo", () => {
  it("arma el arbol de categorias activas; el padre suma sus productos y los de sus hijas", async () => {
    const todas = [
      { id: 1, padreId: null, nombre: "Abarrotes", slug: "abarrotes", orden: 1, estado: "activa" },
      { id: 8, padreId: 1, nombre: "Aceites", slug: "aceites", orden: 1, estado: "activa" },
      { id: 9, padreId: 1, nombre: "Arroz", slug: "arroz", orden: 2, estado: "activa" },
      { id: 2, padreId: null, nombre: "Lacteos", slug: "lacteos", orden: 2, estado: "activa" },
      { id: 3, padreId: null, nombre: "Oculta", slug: "oculta", orden: 3, estado: "oculta" }
    ];
    const catalogoRepository = {
      resumen: async () => ({ proveedoresActivos: 3, productosPorCategoria: [{ categoriaId: 8, productos: 2 }, { categoriaId: 9, productos: 1 }, { categoriaId: 2, productos: 4 }] })
    } as unknown as CatalogoRepository;
    const r = await resumenCatalogo({ catalogoRepository, categoriaRepository: { listar: async () => todas } as unknown as CategoriaRepository })();
    expect(r.proveedoresActivos).toBe(3);
    expect(r.productosComparados).toBe(7);
    expect(r.categorias.map((c) => [c.nombre, c.productos, c.hijos.map((h) => [h.nombre, h.productos])])).toEqual([
      ["Abarrotes", 3, [["Aceites", 2], ["Arroz", 1]]],
      ["Lacteos", 4, []]
    ]);
  });
});

describe("precioNormalizado", () => {
  it("divide por el contenido; sin contenido no hay precio normalizado", () => {
    expect(precioNormalizado(9490, 1, "L")).toEqual({ valor: 9490, por: "L" });
    expect(precioNormalizado(20990, 25, "kg")).toEqual({ valor: 840, por: "kg" });
    expect(precioNormalizado(1000, null, "unidad")).toBeNull();
    expect(precioNormalizado(1000, 0, "kg")).toBeNull();
  });
});
