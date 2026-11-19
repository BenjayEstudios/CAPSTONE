import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { SQL } from "drizzle-orm";
import * as schema from "./schema/index.js";

export function createDbClient(connectionUri: string) {
  const pool = mysql.createPool(connectionUri);
  const db = drizzle(pool, { schema, mode: "default" });
  return { db, pool };
}

// Sin atarlo al Pool: los repositorios aceptan tambien una instancia sobre
// una sola conexion (transacciones, seed, tests).
export type DbClient = MySql2Database<typeof schema>;

// Filas de un SELECT escrito con sql``. db.execute() con mysql2 siempre tipa
// el resultado como ResultSetHeader, aunque sea un SELECT.
export async function consultar<T>(db: DbClient, query: SQL): Promise<T[]> {
  const [filas] = await db.execute(query);
  return filas as unknown as T[];
}
