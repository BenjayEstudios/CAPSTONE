// Mantenimiento de las particiones mensuales de evento_analitico (KAN-140).
// La tabla se particiona por RANGE COLUMNS(creado_en): una particion por mes
// (pAAAAMM guarda ese mes) + pmax de resguardo con MAXVALUE. Este modulo
// calcula que meses faltan; run.ts los crea partiendo pmax.
//
// Los limites van en UTC porque Drizzle guarda los datetime en UTC.

export const TABLA_PARTICIONADA = "evento_analitico";

export interface ParticionMensual {
  nombre: string;
  // Fecha 'AAAA-MM-DD' del VALUES LESS THAN: primer dia del mes siguiente.
  menorQue: string;
}

function primerDiaMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 1));
}

function aFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Particiones que faltan para cubrir hasta el mes de `hasta` (inclusive).
// `limites` son los VALUES LESS THAN de las particiones existentes (sin
// pmax); solo cuenta el mayor. Sin limites no hay de donde partir: la
// particion inicial la crea la migracion.
export function particionesFaltantes(limites: Date[], hasta: Date): ParticionMensual[] {
  if (limites.length === 0) throw new Error(`${TABLA_PARTICIONADA} no tiene particiones mensuales (falta la migracion 0004)`);
  const ultimo = new Date(Math.max(...limites.map((l) => l.getTime())));
  const objetivo = primerDiaMes(hasta.getUTCFullYear(), hasta.getUTCMonth() + 1);

  const faltantes: ParticionMensual[] = [];
  for (let desde = ultimo; desde < objetivo; ) {
    const siguiente = primerDiaMes(desde.getUTCFullYear(), desde.getUTCMonth() + 1);
    const mes = String(desde.getUTCMonth() + 1).padStart(2, "0");
    faltantes.push({ nombre: `p${desde.getUTCFullYear()}${mes}`, menorQue: aFecha(siguiente) });
    desde = siguiente;
  }
  return faltantes;
}

// DDL que parte pmax en los meses faltantes. pmax queda al final, asi que
// los eventos que ya hubieran caido ahi se reubican solos.
export function sqlReorganizar(faltantes: ParticionMensual[]): string {
  const particiones = faltantes.map((p) => `PARTITION \`${p.nombre}\` VALUES LESS THAN ('${p.menorQue}')`);
  return (
    `ALTER TABLE \`${TABLA_PARTICIONADA}\` REORGANIZE PARTITION \`pmax\` INTO (` +
    [...particiones, "PARTITION `pmax` VALUES LESS THAN (MAXVALUE)"].join(", ") +
    ")"
  );
}
