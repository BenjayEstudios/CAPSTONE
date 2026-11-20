import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { FiltrosCatalogo } from "@cotizapp/domain";
import { DrizzleCatalogoRepository, terminoFulltext } from "../src/repositories/catalogo.repository.js";
import { consultar } from "../src/db/client.js";
import { describeDb } from "./db.js";

// Catalogo publico (KAN-145) contra el seed. Cada test corre en una
// transaccion que db.ts revierte (el repositorio no abre transacciones propias).
const ORG = { losAndes: 2, valleCentral: 3, elFogon: 6 };
const RM = { regionCodigo: "13", comunaId: null };
const filtros = (f: Partial<FiltrosCatalogo> = {}): FiltrosCatalogo => ({ orden: "nombre", pagina: 1, porPagina: 100, ...f });

it("terminoFulltext: prefijo, plural simple y sin operadores ni palabras cortas", () => {
  expect(terminoFulltext("Aceites de oliva")).toBe("+aceit* +oliva*");
  expect(terminoFulltext("quesos")).toBe("+queso*");
  expect(terminoFulltext("+limones -x (y)")).toBe("+limon*");
  expect(terminoFulltext("de")).toBe("");
});

describeDb("DrizzleCatalogoRepository", (db) => {
  const repo = () => new DrizzleCatalogoRepository(db());
  const nombres = async (f: Partial<FiltrosCatalogo>) => (await repo().listar(filtros(f))).items.map((i) => i.nombre);

  it("lista solo productos con ofertas visibles: deja fuera borradores, pausadas y proveedores en revision", async () => {
    const { items, total } = await repo().listar(filtros());
    expect(total).toBe(17);
    // Palta: Valle Central (publicada, 4790) y Las Palmas (borrador y en revision, 7490): solo cuenta la primera.
    expect(items.find((i) => i.nombre === "Palta Hass calibre 18")).toMatchObject({ ofertas: 1, precioDesde: 4790, precioHasta: 4790 });
    // Bebida cola: la oferta pausada de Valle Central (3190) no cuenta, solo la publicada.
    const cola = items.find((i) => i.nombre === "Bebida cola")!;
    expect(cola.ofertas).toBe(1);
    expect([cola.precioDesde, cola.precioHasta]).not.toContain(3190);
    const tomate = items.find((i) => i.nombre === "Tomate larga vida")!;
    expect(tomate).toMatchObject({ ofertas: 1, precioDesde: 1390, precioHasta: 1390 }); // la de Las Palmas no cuenta
    const aceite = items.find((i) => i.sku === "ACE-0001")!;
    expect(aceite).toEqual({
      id: 1, sku: "ACE-0001", nombre: "Aceite vegetal maravilla", marca: "Belmont", formato: "Bidón 5 L", contenido: 5,
      unidad: "L", categoriaId: 8, imagenUrl: null, precioDesde: 12490, precioHasta: 12890, ofertas: 2, plazoMinHoras: 24,
      proveedorMasBarato: { id: ORG.losAndes, nombre: "Los Andes Food Service" }
    });
  });

  it("busca sin tildes, por prefijo, en plural y por marca", async () => {
    expect(await nombres({ q: "azucar" })).toEqual(["Azúcar granulada"]);
    expect(await nombres({ q: "quesos" })).toEqual(["Queso gauda laminado", "Queso mozzarella en barra"]);
    expect(await nombres({ q: "aceit" })).toHaveLength(2);
    expect(await nombres({ q: "belmont" })).toEqual(["Aceite vegetal maravilla"]);
    expect(await nombres({ q: "zzz" })).toEqual([]);
  });

  it("los filtros de plazo y caja son por oferta y recalculan los precios", async () => {
    const { items } = await repo().listar(filtros({ plazoMaxHoras: 24, q: "aceite vegetal" }));
    expect(items[0]).toMatchObject({ ofertas: 1, precioDesde: 12490, precioHasta: 12490 }); // Valle Central (48 h) no cuenta
    const chica = await repo().listar(filtros({ maxUnidadesPorCaja: 6 }));
    expect(chica.total).toBeLessThan(17);
  });

  it("KAN-91: proveedor mas barato, retiro, sin minimo y marcas para refinar", async () => {
    const { items, marcas } = await repo().listar(filtros({ q: "aceite" }));
    expect(items.map((i) => i.proveedorMasBarato.nombre)).toEqual(["Los Andes Food Service", "Los Andes Food Service"]);
    expect(marcas).toEqual([{ marca: "Belmont", productos: 1 }, { marca: "Olave", productos: 1 }]);

    // Con marca, la lista de marcas sigue completa (para poder cambiarla).
    const belmont = await repo().listar(filtros({ q: "aceite", marca: "Belmont" }));
    expect(belmont.items.map((i) => i.marca)).toEqual(["Belmont"]);
    expect(belmont.marcas).toHaveLength(2);

    // Retiro: solo ofertas con modalidad retiro o ambos.
    const conRetiro = await repo().listar(filtros({ conRetiro: true }));
    const [n] = await consultar<{ n: number }>(
      db(),
      sql`SELECT COUNT(DISTINCT o.producto_id) AS n FROM oferta o JOIN organizacion org ON org.id = o.proveedor_id
          WHERE o.estado = 'publicada' AND org.estado = 'activa' AND o.modalidad_entrega IN ('retiro','ambos')`
    );
    expect(conRetiro.total).toBe(Number(n!.n));

    // Minimo de compra: una oferta con minimo 5 deja de contar con "sin minimo".
    await db().execute(sql`UPDATE oferta SET minimo_compra = 5 WHERE producto_id = 1`);
    const sinMinimo = await repo().listar(filtros({ maxMinimoCompra: 1 }));
    expect(sinMinimo.items.map((i) => i.id)).not.toContain(1);
    expect((await repo().listar(filtros({ maxMinimoCompra: 6 }))).items.map((i) => i.id)).toContain(1);
  });

  it("orden=diferencia solo trae productos con 2+ ofertas, de mayor a menor diferencia", async () => {
    const { items } = await repo().listar(filtros({ orden: "diferencia", porPagina: 5 }));
    expect(items.every((i) => i.ofertas >= 2)).toBe(true);
    const difs = items.map((i) => i.precioHasta - i.precioDesde);
    expect(difs).toEqual([...difs].sort((a, b) => b - a));
  });

  it("pagina y cuenta el total sin la pagina", async () => {
    const p2 = await repo().listar(filtros({ pagina: 2, porPagina: 5 }));
    expect(p2.total).toBe(17);
    expect(p2.items).toHaveLength(5);
  });

  it("una categoria oculta saca sus productos del listado y de la ficha", async () => {
    await db().execute(sql`UPDATE categoria SET estado = 'oculta' WHERE id = 8`);
    expect(await nombres({ q: "aceite" })).toEqual([]);
    expect(await repo().obtenerFicha(1, RM)).toBeNull();
  });

  it("ficha: categoria con padre, ofertas visibles por precio y datos del proveedor", async () => {
    const f = await repo().obtenerFicha(1, RM);
    expect(f).toMatchObject({
      sku: "ACE-0001", precioReferencia: 12990, contenido: 5,
      categoria: { id: 8, nombre: "Aceites", padre: { id: 1, nombre: "Abarrotes" } }
    });
    expect(f!.ofertas.map((o) => [o.precioUnitario, o.proveedor.id])).toEqual([[12490, ORG.losAndes], [12890, ORG.valleCentral]]);
    expect(f!.ofertas[0]!.proveedor).toEqual({
      id: ORG.losAndes, nombre: "Los Andes Food Service", entregasATiempoPct: 96.5, despachoGratisDesde: 150000, costoDespacho: 4990,
      zona: { comuna: "Quilicura", region: "Metropolitana de Santiago" }
    });
    expect(await repo().obtenerFicha(99999, RM)).toBeNull();
  });

  it("tarifa de despacho: la de la comuna si existe, si no la de la region; null si no despacha ahi", async () => {
    await db().execute(sql`INSERT INTO proveedor_cobertura (proveedor_id, comuna_id, region_codigo, costo_despacho) VALUES (${ORG.losAndes}, 5, '13', 1990)`);
    const costo = async (regionCodigo: string, comunaId: number | null) =>
      (await repo().obtenerFicha(1, { regionCodigo, comunaId }))!.ofertas.map((o) => o.proveedor.costoDespacho);
    expect(await costo("13", 5)).toEqual([1990, 5990]);
    expect(await costo("13", 7)).toEqual([4990, 5990]);
    expect(await costo("05", null)).toEqual([12990, null]);
  });

  it("resumen: proveedores activos y productos visibles por categoria, igual que el listado", async () => {
    const r = await repo().resumen();
    expect(r.proveedoresActivos).toBe(3); // Las Palmas esta en revision
    expect(r.productosPorCategoria.reduce((s, c) => s + c.productos, 0)).toBe((await repo().listar(filtros())).total);
    expect(r.productosPorCategoria.find((c) => c.categoriaId === 8)?.productos).toBe(2); // Aceites
  });

  it("zona de la organizacion desde su direccion", async () => {
    expect(await repo().zonaDeOrganizacion(ORG.elFogon)).toEqual({ regionCodigo: "13", comunaId: 20 });
    expect(await repo().zonaDeOrganizacion(99999)).toBeNull();
  });
});
