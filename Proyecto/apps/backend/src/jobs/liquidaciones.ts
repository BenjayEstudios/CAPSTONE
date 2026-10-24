import "dotenv/config";
import { generarLiquidaciones } from "@cotizapp/application";
import { createDbClient, DrizzleLiquidacionRepository } from "@cotizapp/infrastructure";
import { loadEnv } from "../config/env.js";

// Job de liquidaciones semanales (KAN-152). Uso:
//   pnpm job:liquidaciones                       -> semana anterior (lunes a domingo, America/Santiago)
//   pnpm job:liquidaciones 2026-10-12 [2026-10-18] -> periodo explicito [desde, hasta]
// Idempotente: los envios ya liquidados se omiten, re-ejecutar no duplica. Exit code 1 si algun proveedor falla.
const env = loadEnv();
const { db, pool } = createDbClient(env.DATABASE_URL);
let codigo = 0;
try {
  const [desde, hasta] = process.argv.slice(2);
  const r = await generarLiquidaciones({ liquidacionRepository: new DrizzleLiquidacionRepository(db) })({ desde, hasta }, null);
  console.log(JSON.stringify({ ...r, liquidaciones: r.liquidaciones.map((l) => l.id) }));
  if (r.errores.length) codigo = 1;
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  codigo = 1;
} finally {
  await pool.end();
}
process.exit(codigo);
