import type mysql from "mysql2/promise";
import { particionesFaltantes, sqlReorganizar, TABLA_PARTICIONADA } from "./particiones.js";

export interface ResultadoParticiones {
  // Ultimo mes cubierto ('AAAA-MM').
  hasta: string;
  creadas: string[];
}

// Crea las particiones mensuales de evento_analitico que falten para cubrir
// el mes de `hoy` + `mesesAdelante`. Idempotente: si ya estan, no hace nada.
// No borra datos: solo parte pmax. Lo usan `pnpm db:particiones` (run.ts) y
// el paso de migraciones del deploy (db/migrar/run.ts).
export async function asegurarParticiones(
  conexion: mysql.Connection,
  mesesAdelante: number,
  hoy: Date = new Date()
): Promise<ResultadoParticiones> {
  const [filas] = await conexion.query<mysql.RowDataPacket[]>(
    `SELECT PARTITION_DESCRIPTION AS limite FROM information_schema.PARTITIONS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND PARTITION_DESCRIPTION <> 'MAXVALUE'`,
    [TABLA_PARTICIONADA]
  );
  // PARTITION_DESCRIPTION viene como "'2026-12-01'".
  const limites = filas.map((f) => new Date(`${String(f.limite).replace(/'/g, "")}T00:00:00Z`));

  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + mesesAdelante, 1));
  const faltantes = particionesFaltantes(limites, hasta);
  if (faltantes.length > 0) await conexion.query(sqlReorganizar(faltantes));
  return { hasta: hasta.toISOString().slice(0, 7), creadas: faltantes.map((p) => p.nombre) };
}
