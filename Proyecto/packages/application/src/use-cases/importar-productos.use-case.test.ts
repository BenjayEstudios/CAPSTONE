import { describe, expect, it } from "vitest";
import type { Categoria } from "@cotizapp/domain";
import { categoriaRepoEnMemoria } from "./categoria.use-cases.test.js";
import { claveDeEncabezado, importarProductos, MAX_FILAS_IMPORTACION, type FilaImportacion } from "./importar-productos.use-case.js";
import { productoRepoEnMemoria } from "./producto.use-cases.test.js";

const categorias: Categoria[] = [
  { id: 1, padreId: null, nombre: "Alimentos", slug: "alimentos", orden: 1, estado: "activa" },
  { id: 2, padreId: 1, nombre: "Secos", slug: "secos", orden: 1, estado: "activa" },
  { id: 3, padreId: null, nombre: "Bebidas", slug: "bebidas", orden: 2, estado: "activa" },
  { id: 4, padreId: 3, nombre: "Secos", slug: "secos-bebidas", orden: 1, estado: "activa" }
];

function setup() {
  const productoRepository = productoRepoEnMemoria();
  const categoriaRepository = categoriaRepoEnMemoria(categorias);
  const importar = importarProductos({ productoRepository, categoriaRepository });
  return { productoRepository, importar };
}

let n = 1;
const fila = (valores: FilaImportacion["valores"]): FilaImportacion => ({ fila: ++n, valores });
const nuevo = (extra: FilaImportacion["valores"] = {}) =>
  fila({ sku: "arr-001", nombre: "Arroz", categoria: "Alimentos > Secos", unidad: "kg", ...extra });

describe("importarProductos", () => {
  it("crea los SKU nuevos (normaliza SKU, unidad y categoria por ruta)", async () => {
    const { importar, productoRepository } = setup();
    const r = await importar([nuevo({ unidad: "KG", precioReferencia: "$28.000", contenido: "25,5" })], 7, { simular: false });
    expect(r.resumen).toEqual({ crear: 1, actualizar: 0, sinCambios: 0, errores: 0 });
    expect(productoRepository.datos[0]).toMatchObject({
      sku: "ARR-001", categoriaId: 2, unidad: "kg", precioReferencia: 28000, contenido: 25.5, estado: "borrador", creadoPor: 7
    });
  });

  it("SKU existente -> actualiza solo lo informado; celdas vacias no tocan", async () => {
    const { importar, productoRepository } = setup();
    await importar([nuevo({ marca: "Tucapel", precioReferencia: 1000 })], 1, { simular: false });
    const r = await importar([fila({ sku: "ARR-001", nombre: "Arroz premium", marca: "", precioReferencia: 1200 })], 1, { simular: false });
    expect(r.resumen).toMatchObject({ crear: 0, actualizar: 1 });
    expect(productoRepository.datos).toHaveLength(1);
    expect(productoRepository.datos[0]).toMatchObject({ nombre: "Arroz premium", marca: "Tucapel", precioReferencia: 1200 });
  });

  it("SKU existente sin diferencias -> sin_cambios", async () => {
    const { importar } = setup();
    await importar([nuevo()], 1, { simular: false });
    const r = await importar([fila({ sku: "ARR-001", nombre: "Arroz", unidad: "kg" })], 1, { simular: false });
    expect(r.filas[0]).toMatchObject({ accion: "sin_cambios" });
  });

  it("simulacion: informa lo que haria y no escribe", async () => {
    const { importar, productoRepository } = setup();
    const r = await importar([nuevo()], 1, { simular: true });
    expect(r).toMatchObject({ simulacion: true, resumen: { crear: 1 } });
    expect(productoRepository.datos).toHaveLength(0);
  });

  it("errores por fila no detienen a las demas", async () => {
    const { importar, productoRepository } = setup();
    const r = await importar(
      [
        nuevo({ sku: "A-1" }),
        nuevo({ sku: "A-2", categoria: "No existe" }),
        nuevo({ sku: "A-3", nombre: undefined }),
        nuevo({ sku: "A-4", unidad: "caja" }),
        nuevo({ sku: "A-5", precioReferencia: "mucho" }),
        nuevo({ sku: "A-6", estado: "publicado", precioReferencia: 1000 }),
        fila({ nombre: "sin sku" })
      ],
      1,
      { simular: false }
    );
    expect(r.resumen).toMatchObject({ crear: 1, errores: 6 });
    expect(r.filas.map((f) => f.error?.codigo)).toEqual([
      undefined, "CATEGORIA_NO_EXISTE", "VALIDACION", "VALIDACION", "VALIDACION", "PUBLICACION_INCOMPLETA", "VALIDACION"
    ]);
    expect(r.filas[2].error?.mensaje).toContain("nombre");
    expect(productoRepository.datos.map((p) => p.sku)).toEqual(["A-1"]);
  });

  it("SKU o EAN repetido dentro del archivo -> error en la segunda fila", async () => {
    const { importar } = setup();
    const r = await importar(
      [nuevo({ sku: "A-1", ean: "7801234567890" }), nuevo({ sku: "a-1" }), nuevo({ sku: "A-2", ean: "7801234567890" })],
      1,
      { simular: true }
    );
    expect(r.filas.map((f) => f.error?.codigo)).toEqual([undefined, "SKU_REPETIDO_EN_ARCHIVO", "EAN_REPETIDO_EN_ARCHIVO"]);
  });

  it("EAN de otro producto -> 409 por fila", async () => {
    const { importar } = setup();
    await importar([nuevo({ ean: "7801234567890" })], 1, { simular: false });
    const r = await importar([nuevo({ sku: "OTRO", ean: "7801234567890" })], 1, { simular: false });
    expect(r.filas[0].error?.codigo).toBe("EAN_DUPLICADO");
  });

  it("categoria: por ID, por nombre unico y ambigua", async () => {
    const { importar, productoRepository } = setup();
    const r = await importar(
      [nuevo({ sku: "A-1", categoria: 3 }), nuevo({ sku: "A-2", categoria: "bebídas" }), nuevo({ sku: "A-3", categoria: "Secos" })],
      1,
      { simular: false }
    );
    expect(productoRepository.datos.map((p) => p.categoriaId)).toEqual([3, 3]);
    expect(r.filas[2].error?.codigo).toBe("CATEGORIA_AMBIGUA");
  });

  it("archivo vacio o demasiado grande -> 400", async () => {
    const { importar } = setup();
    await expect(importar([], 1, { simular: true })).rejects.toMatchObject({ code: "ARCHIVO_VACIO" });
    const muchas = Array.from({ length: MAX_FILAS_IMPORTACION + 1 }, (_, i) => nuevo({ sku: `S-${i}` }));
    await expect(importar(muchas, 1, { simular: true })).rejects.toMatchObject({ code: "DEMASIADAS_FILAS" });
  });
});

describe("claveDeEncabezado", () => {
  it("reconoce encabezados con tildes, mayusculas y alias", () => {
    expect(claveDeEncabezado("SKU")).toBe("sku");
    expect(claveDeEncabezado("Categoría")).toBe("categoria");
    expect(claveDeEncabezado("Precio referencia")).toBe("precioReferencia");
    expect(claveDeEncabezado("Tope sobre referencia (%)")).toBe("topeSobreReferenciaPct");
    expect(claveDeEncabezado("columna rara")).toBeNull();
  });
});
