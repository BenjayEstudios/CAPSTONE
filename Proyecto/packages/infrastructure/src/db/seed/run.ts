import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableName, is, sql } from "drizzle-orm";
import { MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../schema/index.js";
import { seed } from "./seed.js";

// Entry point de `pnpm --filter @cotizapp/infrastructure db:seed`.
// VACIA todas las tablas del schema y carga los datos de prueba. Igual que
// drizzle.config.ts, lee DATABASE_URL del entorno y cae al MySQL local del
// docker-compose si no esta definida.
const url = process.env.DATABASE_URL ?? "mysql://cotizapp:cotizapp@localhost:3306/cotizapp";
const host = new URL(url).hostname;
const HOSTS_LOCALES = ["localhost", "127.0.0.1", "[::1]", "mysql"];

// Guarda contra borrar por accidente una base compartida (p. ej. Aiven).
if (!HOSTS_LOCALES.includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(
    `DATABASE_URL apunta a "${host}", que no es local. El seed vacia TODAS las tablas.\n` +
      "Si de verdad quieres hacerlo, vuelve a correrlo con --allow-remote."
  );
  process.exit(1);
}

// Una sola conexion (no pool): FOREIGN_KEY_CHECKS es variable de sesion.
const connection = await mysql.createConnection(url);
const db = drizzle(connection, { schema, mode: "default" });

try {
  const tablas = Object.values(schema as Record<string, unknown>)
    .filter((t): t is MySqlTable => is(t, MySqlTable))
    .map(getTableName);

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const tabla of tablas) {
    await db.execute(sql.raw(`TRUNCATE TABLE \`${tabla}\``));
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  console.log(`Vaciadas ${tablas.length} tablas en ${host}.`);

  await seed(db);
  console.log("Seed cargado.");
} finally {
  await connection.end();
}
