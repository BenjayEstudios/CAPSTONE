import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe } from "vitest";
import * as schema from "../src/db/schema/index.js";
import { consultar, type DbClient } from "../src/db/client.js";

// Tests de integracion contra el MySQL local con el seed cargado
// (`pnpm db:migrate && pnpm db:seed`). Cada test corre dentro de una
// transaccion que se revierte al final, asi que no ensucia los datos.
//
// En CI no hay MySQL: si no hay base alcanzable y CI esta definida, la
// suite se salta. En local, si la base no responde, falla con el motivo.
const url = process.env.DATABASE_URL ?? "mysql://cotizapp:cotizapp@localhost:3306/cotizapp";
const HOSTS_LOCALES = ["localhost", "127.0.0.1", "[::1]", "mysql"];
if (!HOSTS_LOCALES.includes(new URL(url).hostname)) {
  throw new Error(`Los tests de integracion solo corren contra un MySQL local, no contra ${new URL(url).hostname}.`);
}

async function conectar() {
  try {
    return await mysql.createConnection({ uri: url, connectTimeout: 2000 });
  } catch (err) {
    if (process.env.CI) return null;
    throw new Error(`No hay MySQL en ${url} (docker compose up -d mysql): ${(err as Error).message}`);
  }
}

const conexion = await conectar();
afterAll(async () => {
  await conexion?.end();
});

// describe() que se salta si no hay base (solo pasa en CI). Entrega un
// getter porque la instancia se arma en beforeAll.
export function describeDb(nombre: string, fn: (db: () => DbClient) => void) {
  describe.skipIf(!conexion)(nombre, () => {
    let db: DbClient;
    beforeAll(async () => {
      db = drizzle(conexion!, { schema, mode: "default" });
      const [fila] = await consultar<{ n: number }>(db, sql`SELECT COUNT(*) AS n FROM orden WHERE codigo = 'CM-10011'`);
      if (fila!.n !== 1) throw new Error("La base no tiene el seed actual: corre pnpm --filter @cotizapp/infrastructure db:seed");
    });
    beforeEach(async () => {
      await db.execute(sql`START TRANSACTION`);
    });
    afterEach(async () => {
      await db.execute(sql`ROLLBACK`);
    });
    fn(() => db);
  });
}
