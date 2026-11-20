import { afterEach, beforeEach, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { CambioPrecioStock, NuevaOferta } from "@cotizapp/domain";
import { DrizzleOfertaRepository } from "../src/repositories/oferta.repository.js";
import { DrizzleModeracionRepository } from "../src/repositories/moderacion.repository.js";
import { consultar } from "../src/db/client.js";
import { describeDb } from "./db.js";

// DrizzleOfertaRepository abre sus propias transacciones (oferta + historial),
// y en MySQL un BEGIN confirma la transaccion externa de describeDb: estos
// tests borran lo que crean. Usan el tomate (producto 15), que Los Andes no oferta en el seed.
const LOS_ANDES = 2;
const TOMATE = 15;
const USUARIO_LOS_ANDES = 4;

const nueva = (o: Partial<NuevaOferta> = {}): NuevaOferta => ({
  productoId: TOMATE, proveedorId: LOS_ANDES, precioUnitario: 1450, unidadesPorCaja: 10, cajasDisponibles: 30,
  minimoCompra: 1, plazoHoras: 24, modalidadEntrega: "ambos", notasCliente: null, estado: "publicada", ...o
});
const alta = (cajas: number | null = 30): CambioPrecioStock => ({
  precioAnterior: null, precioNuevo: 1450, cajasAnteriores: null, cajasNuevas: cajas, motivo: "Creacion de la oferta", cambiadoPor: USUARIO_LOS_ANDES
});

describeDb("DrizzleOfertaRepository", (db) => {
  const repo = () => new DrizzleOfertaRepository(db());
  const limpiar = async () => {
    await db().execute(sql`ROLLBACK`);
    await db().execute(sql`DELETE h FROM oferta_precio_historial h JOIN oferta o ON o.id = h.oferta_id WHERE o.producto_id = ${TOMATE} AND o.proveedor_id = ${LOS_ANDES}`);
    await db().execute(sql`DELETE FROM oferta WHERE producto_id = ${TOMATE} AND proveedor_id = ${LOS_ANDES}`);
  };
  beforeEach(limpiar);
  afterEach(limpiar);

  const historial = async (ofertaId: number) =>
    consultar<{ precio_anterior: number | null; precio_nuevo: number; cajas_anteriores: number | null; cajas_nuevas: number | null; motivo: string | null }>(
      db(),
      sql`SELECT precio_anterior, precio_nuevo, cajas_anteriores, cajas_nuevas, motivo FROM oferta_precio_historial WHERE oferta_id = ${ofertaId} ORDER BY id`
    );

  it("crear guarda la oferta con cajas iniciales, sus datos de producto y la fila inicial del historial", async () => {
    const o = await repo().crear(nueva(), alta());
    expect(o).toMatchObject({
      productoId: TOMATE, proveedorId: LOS_ANDES, precioUnitario: 1450, cajasDisponibles: 30, cajasIniciales: 30, estado: "publicada",
      producto: { id: TOMATE, nombre: "Tomate larga vida", unidad: "kg" }
    });
    expect(await historial(o.id)).toEqual([{ precio_anterior: null, precio_nuevo: 1450, cajas_anteriores: null, cajas_nuevas: 30, motivo: "Creacion de la oferta" }]);
    expect((await repo().buscarPorProductoYProveedor(TOMATE, LOS_ANDES))?.id).toBe(o.id);
  });

  it("actualizar cambia solo lo pedido e inserta historial cuando corresponde", async () => {
    const o = await repo().crear(nueva(), alta());
    await repo().actualizar(o.id, { notasCliente: "Nota" }, null);
    const u = await repo().actualizar(o.id, { precioUnitario: 1550, estado: "pausada" }, {
      precioAnterior: 1450, precioNuevo: 1550, cajasAnteriores: 30, cajasNuevas: 30, motivo: "Alza", cambiadoPor: USUARIO_LOS_ANDES
    });
    expect(u).toMatchObject({ precioUnitario: 1550, estado: "pausada", notasCliente: "Nota", cajasIniciales: 30 });
    expect((await historial(o.id)).map((h) => h.motivo)).toEqual(["Creacion de la oferta", "Alza"]);
  });

  it("productos disponibles excluye los ya ofertados por el proveedor y los no publicados", async () => {
    const antes = await repo().productosDisponibles(LOS_ANDES, { pagina: 1, tamano: 50 });
    expect(antes.items.map((p) => p.id)).toContain(TOMATE);
    await repo().crear(nueva({ estado: "borrador" }), alta());
    const despues = await repo().productosDisponibles(LOS_ANDES, { pagina: 1, tamano: 50 });
    expect(despues.items.map((p) => p.id)).not.toContain(TOMATE);
    expect(despues.total).toBe(antes.total - 1);
    expect((await repo().productosDisponibles(LOS_ANDES, { q: "tomate", pagina: 1, tamano: 50 })).total).toBe(0);
  });

  it("listar del proveedor filtra por estado y texto, y no trae ofertas de otros", async () => {
    await repo().crear(nueva({ estado: "borrador" }), alta());
    const borradores = await repo().listarDeProveedor(LOS_ANDES, { estado: "borrador", pagina: 1, tamano: 50 });
    expect(borradores.items.map((o) => o.productoId)).toEqual([TOMATE]);
    const todas = await repo().listarDeProveedor(LOS_ANDES, { pagina: 1, tamano: 100 });
    expect(todas.items.every((o) => o.proveedorId === LOS_ANDES)).toBe(true);
    expect((await repo().listarDeProveedor(LOS_ANDES, { q: "tomate", pagina: 1, tamano: 50 })).total).toBe(1);
  });

  it("eliminar borra la oferta y su historial; tieneVentas mira orden_linea", async () => {
    const o = await repo().crear(nueva({ estado: "borrador" }), alta());
    expect(await repo().tieneVentas(o.id)).toBe(false);
    await repo().eliminar(o.id);
    expect(await repo().buscarPorId(o.id)).toBeNull();
    expect(await historial(o.id)).toEqual([]);
    const [vendida] = await consultar<{ oferta_id: number }>(db(), sql`SELECT oferta_id FROM orden_linea LIMIT 1`);
    expect(await repo().tieneVentas(vendida!.oferta_id)).toBe(true);
  });

  it("moderacion describe una oferta como producto · proveedor · precio", async () => {
    const o = await repo().crear(nueva({ precioUnitario: 1990 }), alta());
    expect(await new DrizzleModeracionRepository(db()).resolverEntidad("oferta", o.id)).toEqual({
      entidad: "oferta", id: o.id, etiqueta: "Tomate larga vida · Los Andes Food Service · $1.990"
    });
  });
});
