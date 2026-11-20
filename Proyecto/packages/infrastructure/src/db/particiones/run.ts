import mysql from "mysql2/promise";
import { asegurarParticiones } from "./asegurar.js";
import { TABLA_PARTICIONADA } from "./particiones.js";

// Entry point de `pnpm --filter @cotizapp/infrastructure db:particiones`.
// Crea las particiones mensuales de evento_analitico que falten para cubrir
// el mes actual + MESES_ADELANTE (por defecto 3; `-- --meses 6` para otro
// valor). Es idempotente: si ya estan, no hace nada. Correrlo una vez al
// mes. Igual que drizzle.config.ts, usa DATABASE_URL o el MySQL local. No
// borra datos (solo parte la particion pmax), por eso no pide --allow-remote.
const url = process.env.DATABASE_URL ?? "mysql://cotizapp:cotizapp@localhost:3306/cotizapp";
const i = process.argv.indexOf("--meses");
const mesesAdelante = i >= 0 ? Number(process.argv[i + 1]) : 3;
if (!Number.isInteger(mesesAdelante) || mesesAdelante < 0) {
  console.error("--meses debe ser un entero >= 0");
  process.exit(1);
}

const connection = await mysql.createConnection(url);
try {
  const { hasta, creadas } = await asegurarParticiones(connection, mesesAdelante);
  const host = new URL(url).hostname;
  if (creadas.length === 0) {
    console.log(`${TABLA_PARTICIONADA} en ${host} ya tiene particiones hasta ${hasta}.`);
  } else {
    console.log(`Creadas en ${host}: ${creadas.join(", ")}.`);
  }
} finally {
  await connection.end();
}
