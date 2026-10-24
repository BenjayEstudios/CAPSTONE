import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { CalificacionError } from "@cotizapp/domain";
import { DrizzleCalificacionRepository } from "../src/repositories/calificacion.repository.js";
import { consultar, type DbClient } from "../src/db/client.js";
import { describeDb } from "./db.js";

// Ids fijos del seed (src/db/seed/seed.ts).
const ORG = { losAndes: 2, valleCentral: 3, frigoSur: 4, lasPalmas: 5 };
const USR = { elFogon: 8, dulceHogar: 9 };

async function envioDe(db: DbClient, codigoOrden: string, proveedorId: number): Promise<number> {
  const [fila] = await consultar<{ id: number }>(db, sql`
    SELECT oe.id FROM orden_envio oe JOIN orden o ON o.id = oe.orden_id
    WHERE o.codigo = ${codigoOrden} AND oe.proveedor_id = ${proveedorId}`);
  return fila!.id;
}

describeDb("DrizzleCalificacionRepository", (db) => {
  const repo = () => new DrizzleCalificacionRepository(db());

  it("resume promedio y cantidad por proveedor, incluyendo los que no tienen calificaciones", async () => {
    const resumen = await repo().resumenPorProveedor([ORG.losAndes, ORG.valleCentral, ORG.frigoSur, ORG.lasPalmas]);
    expect(resumen).toEqual([
      { proveedorId: ORG.losAndes, promedio: 4.67, cantidad: 6 },
      { proveedorId: ORG.valleCentral, promedio: 3.8, cantidad: 5 },
      { proveedorId: ORG.frigoSur, promedio: 4.4, cantidad: 5 },
      { proveedorId: ORG.lasPalmas, promedio: null, cantidad: 0 }
    ]);
  });

  it("sin ids devuelve solo los proveedores calificados", async () => {
    const resumen = await repo().resumenPorProveedor();
    expect(resumen.map((r) => r.proveedorId).sort()).toEqual([ORG.losAndes, ORG.valleCentral, ORG.frigoSur]);
    expect(await repo().resumenPorProveedor([])).toEqual([]);
  });

  it("registra la calificacion de un envio entregado y actualiza el promedio", async () => {
    const envioId = await envioDe(db(), "CM-10010", ORG.frigoSur);
    const creada = await repo().registrar({ ordenEnvioId: envioId, usuarioId: USR.dulceHogar, puntaje: 2, comentario: "Llegó tarde" });
    expect(creada).toMatchObject({ ordenEnvioId: envioId, usuarioId: USR.dulceHogar, puntaje: 2, comentario: "Llegó tarde" });

    const [frigo] = await repo().resumenPorProveedor([ORG.frigoSur]);
    expect(frigo).toEqual({ proveedorId: ORG.frigoSur, promedio: 4, cantidad: 6 });
    expect((await repo().listarPorProveedor(ORG.frigoSur, 1))[0]!.id).toBe(creada.id);
  });

  it("rechaza un envio ya calificado", async () => {
    const envioId = await envioDe(db(), "CM-10001", ORG.losAndes);
    await expect(repo().registrar({ ordenEnvioId: envioId, usuarioId: USR.elFogon, puntaje: 5 })).rejects.toEqual(
      new CalificacionError("ya_calificado")
    );
  });

  it("rechaza un envio no entregado o a un usuario de otra organizacion", async () => {
    const enPreparacion = await envioDe(db(), "CM-10002", ORG.valleCentral);
    await expect(repo().registrar({ ordenEnvioId: enPreparacion, usuarioId: USR.dulceHogar, puntaje: 4 })).rejects.toMatchObject({
      codigo: "envio_no_calificable"
    });

    const deDulceHogar = await envioDe(db(), "CM-10010", ORG.valleCentral);
    await expect(repo().registrar({ ordenEnvioId: deDulceHogar, usuarioId: USR.elFogon, puntaje: 4 })).rejects.toMatchObject({
      codigo: "envio_no_calificable"
    });
  });

  it("el CHECK de la base frena un puntaje fuera de 1-5 aunque se salte el schema de zod", async () => {
    const envioId = await envioDe(db(), "CM-10010", ORG.valleCentral);
    await expect(repo().registrar({ ordenEnvioId: envioId, usuarioId: USR.dulceHogar, puntaje: 6 })).rejects.toMatchObject({
      codigo: "puntaje_invalido"
    });
  });

  it("listarPorProveedor devuelve las mas recientes primero", async () => {
    const lista = await repo().listarPorProveedor(ORG.losAndes);
    expect(lista).toHaveLength(6);
    const fechas = lista.map((c) => c.creadaEn.getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });
});
