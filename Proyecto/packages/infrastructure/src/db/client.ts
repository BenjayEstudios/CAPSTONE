import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema/index.js";

export function createDbClient(connectionUri: string) {
  const pool = mysql.createPool(connectionUri);
  const db = drizzle(pool, { schema, mode: "default" });
  return { db, pool };
}

export type DbClient = ReturnType<typeof createDbClient>["db"];
