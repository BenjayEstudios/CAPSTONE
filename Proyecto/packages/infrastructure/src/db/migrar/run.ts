import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { asegurarParticiones } from "../particiones/asegurar.js";
import { TABLA_PARTICIONADA } from "../particiones/particiones.js";
import { HistorialInvalido, planificar, type FilaHistorial, type MigracionLocal } from "./historial.js";

// Paso de migraciones del deploy: `node packages/infrastructure/dist/db/migrar/run.js`
// dentro de la imagen del backend (no necesita drizzle-kit, que es devDependency).
// Usa el mismo migrator de drizzle-orm que `drizzle-kit migrate`, asi que la
// tabla __drizzle_migrations queda igual con cualquiera de los dos.
//
// 1. Revisa el historial completo antes de tocar nada (ver historial.ts).
// 2. Aplica las migraciones pendientes.
// 3. Asegura las particiones de evento_analitico (idempotente, ver
//    particiones/asegurar.ts).
//
// Igual que drizzle.config.ts, usa DATABASE_URL o el MySQL local.
const url = process.env.DATABASE_URL ?? "mysql://cotizapp:cotizapp@localhost:3306/cotizapp";
const TABLA_HISTORIAL = "__drizzle_migrations";
// dist/db/migrar/run.js y src/db/migrar/run.ts quedan a la misma altura de migrations/.
const carpeta = process.env.MIGRATIONS_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migrations");

function migracionesLocales(): MigracionLocal[] {
  const journal = JSON.parse(readFileSync(path.join(carpeta, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
  return readMigrationFiles({ migrationsFolder: carpeta }).map((m, i) => ({
    tag: journal.entries[i]!.tag,
    hash: m.hash,
    creadaEn: m.folderMillis
  }));
}

async function contarTablas(conexion: mysql.Connection, nombre?: string): Promise<number> {
  const [filas] = await conexion.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()${nombre ? " AND TABLE_NAME = ?" : ""}`,
    nombre ? [nombre] : []
  );
  return Number(filas[0]!.n);
}

const host = new URL(url).hostname;
const conexion = await mysql.createConnection(url);
try {
  const locales = migracionesLocales();

  let historial: FilaHistorial[] = [];
  if ((await contarTablas(conexion, TABLA_HISTORIAL)) > 0) {
    const [filas] = await conexion.query<mysql.RowDataPacket[]>(`SELECT hash, created_at FROM \`${TABLA_HISTORIAL}\``);
    historial = filas as FilaHistorial[];
  } else {
    const tablas = await contarTablas(conexion);
    if (tablas > 0)
      throw new HistorialInvalido(
        `La base en ${host} tiene ${tablas} tabla(s) pero no ${TABLA_HISTORIAL}: se creo sin migraciones ` +
          `(¿drizzle-kit push?). No se migra encima. Revisar a mano.`
      );
  }

  const { aplicadas, pendientes } = planificar(locales, historial);
  console.log(`Migraciones en ${host}: ${aplicadas.length} aplicada(s), ${pendientes.length} pendiente(s).`);
  if (pendientes.length > 0) {
    for (const m of pendientes) console.log(`  aplicando ${m.tag}`);
    await migrate(drizzle(conexion), { migrationsFolder: carpeta, migrationsTable: TABLA_HISTORIAL });
    console.log("Migraciones aplicadas.");
  }

  // Particiones: solo si la tabla existe y ya esta particionada (la
  // particion inicial la crea la migracion 0001).
  const [part] = await conexion.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM information_schema.PARTITIONS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND PARTITION_NAME IS NOT NULL`,
    [TABLA_PARTICIONADA]
  );
  if (Number(part[0]!.n) > 0) {
    const { hasta, creadas } = await asegurarParticiones(conexion, 3);
    console.log(
      creadas.length > 0
        ? `Particiones de ${TABLA_PARTICIONADA} creadas: ${creadas.join(", ")}.`
        : `Particiones de ${TABLA_PARTICIONADA} al dia hasta ${hasta}.`
    );
  }
} catch (err) {
  console.error(err instanceof HistorialInvalido ? `ERROR: ${err.message}` : err);
  process.exitCode = 1;
} finally {
  await conexion.end();
}
