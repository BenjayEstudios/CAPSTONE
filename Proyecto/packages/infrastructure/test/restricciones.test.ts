import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { consultar, type DbClient } from "../src/db/client.js";
import { describeDb } from "./db.js";

// Indices y restricciones de KAN-140 que Drizzle no ve o no puede declarar
// (FULLTEXT, particiones): estos tests fallan si una migracion los pierde.
type FilaExplain = { key: string | null; partitions: string | null; type: string; Extra: string | null };

const explain = async (db: DbClient, query: ReturnType<typeof sql>) => (await consultar<FilaExplain>(db, sql`EXPLAIN ${query}`))[0]!;

function errnoDe(err: unknown): number | undefined {
  const e = err as { errno?: number; cause?: { errno?: number } };
  return e.cause?.errno ?? e.errno;
}

describeDb("restricciones e indices (KAN-140)", (db) => {
  it("ck_orden_envio_destino exige destino segun la modalidad y nunca ambos", async () => {
    const insertar = (modalidad: string, puntoRetiroId: number | null, direccionEntregaId: number | null) =>
      db().execute(sql`
        INSERT INTO orden_envio (orden_id, proveedor_id, modalidad, punto_retiro_id, direccion_entrega_id, subtotal, comision_pct, comision_monto)
        VALUES (1, 2, ${modalidad}, ${puntoRetiroId}, ${direccionEntregaId}, 0, 8, 0)`);

    for (const [modalidad, punto, direccion] of [
      ["retiro", 1, 6],
      ["retiro", null, null],
      ["despacho", null, null],
      ["despacho", 1, null]
    ] as const) {
      await insertar(modalidad, punto, direccion).then(
        () => expect.fail(`deberia rechazar ${modalidad} punto=${punto} direccion=${direccion}`),
        (err) => expect(errnoDe(err)).toBe(3819)
      );
    }
    await expect(insertar("retiro", 1, null)).resolves.toBeDefined();
    await expect(insertar("despacho", null, 6)).resolves.toBeDefined();
  });

  it("la busqueda por nombre usa el FULLTEXT y no distingue tildes", async () => {
    const filas = await consultar<{ nombre: string }>(db(), sql`SELECT nombre FROM producto WHERE MATCH(nombre) AGAINST('azucar')`);
    expect(filas.map((f) => f.nombre)).toEqual(["Azúcar granulada"]);

    const plan = await explain(db(), sql`SELECT id FROM producto WHERE MATCH(nombre) AGAINST('aceite')`);
    expect(plan).toMatchObject({ type: "fulltext", key: "ix_producto_nombre_fulltext" });
  });

  it("evento_analitico esta particionada por mes y una consulta por rango solo lee esas particiones", async () => {
    const particiones = await consultar<{ nombre: string }>(db(), sql`
      SELECT PARTITION_NAME AS nombre FROM information_schema.PARTITIONS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evento_analitico' ORDER BY PARTITION_ORDINAL_POSITION`);
    expect(particiones.map((p) => p.nombre)).toEqual(expect.arrayContaining(["p_anterior", "p202609", "p202610", "pmax"]));
    expect(particiones.at(-1)!.nombre).toBe("pmax");

    const plan = await explain(
      db(),
      sql`SELECT COUNT(*) FROM evento_analitico WHERE creado_en >= '2026-10-01' AND creado_en < '2026-10-15'`
    );
    expect(plan.partitions).toBe("p202610");
  });

  it("el comparador usa ix_oferta_comparador sin filesort", async () => {
    const plan = await explain(
      db(),
      sql`SELECT id, proveedor_id, precio_unitario FROM oferta WHERE producto_id = 9 AND estado = 'publicada' ORDER BY precio_unitario`
    );
    expect(plan).toMatchObject({ type: "ref", key: "ix_oferta_comparador" });
    expect(plan.Extra ?? "").not.toMatch(/filesort/);
  });
});
