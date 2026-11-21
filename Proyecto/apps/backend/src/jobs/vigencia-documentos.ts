import "dotenv/config";
import { actualizarVigenciaDocumentos } from "@cotizapp/application";
import { createDbClient, DrizzleProveedorRepository } from "@cotizapp/infrastructure";
import { loadEnv } from "../config/env.js";

// Job de vigencia de documentos de proveedores (KAN-150). Uso:
//   pnpm job:vigencia-documentos
// Recalcula al_dia / por_vencer / vencido segun vence_en (hoy, hora de Chile) y
// deja cada cambio en auditoria_log. Idempotente. Pensado para correr una vez
// al dia (cron; ver el README del backend). Exit code 1 si algun documento falla.
const env = loadEnv();
const { db, pool } = createDbClient(env.DATABASE_URL);
let codigo = 0;
try {
  const r = await actualizarVigenciaDocumentos({
    proveedorRepository: new DrizzleProveedorRepository(db),
    log: (mensaje, error) => console.error(mensaje, error instanceof Error ? error.message : error ?? "")
  })();
  console.log(JSON.stringify(r));
  if (r.errores.length) codigo = 1;
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  codigo = 1;
} finally {
  await pool.end();
}
process.exit(codigo);
