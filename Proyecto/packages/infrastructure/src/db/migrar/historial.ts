// Reglas de seguridad del paso de migraciones (db/migrar/run.ts). Logica
// pura: no toca la base, asi que se testea sin MySQL.
//
// El migrator de drizzle-orm (el mismo que usa `drizzle-kit migrate`) solo
// mira la fila mas reciente de __drizzle_migrations: aplica toda migracion
// cuyo `when` del journal sea mayor que ese created_at. Con un historial
// ajeno (paso en Aiven con migraciones viejas) eso falla en silencio: o se
// salta migraciones, o intenta crear tablas que ya existen. Por eso antes de
// migrar se compara el historial COMPLETO contra las migraciones actuales.

export interface MigracionLocal {
  tag: string;
  // sha256 del .sql: lo que drizzle guarda en __drizzle_migrations.hash.
  hash: string;
  // `when` del journal: lo que drizzle guarda en created_at.
  creadaEn: number;
}

export interface FilaHistorial {
  hash: string;
  created_at: number | string;
}

export interface Plan {
  aplicadas: MigracionLocal[];
  pendientes: MigracionLocal[];
}

export class HistorialInvalido extends Error {
  override name = "HistorialInvalido";
}

export function planificar(locales: MigracionLocal[], historial: FilaHistorial[]): Plan {
  const hashesLocales = new Set(locales.map((m) => m.hash));
  const desconocidas = historial.filter((f) => !hashesLocales.has(f.hash));
  if (desconocidas.length > 0) {
    const detalle = desconocidas.map((f) => `created_at=${f.created_at} hash=${f.hash.slice(0, 12)}…`).join("; ");
    throw new HistorialInvalido(
      `__drizzle_migrations tiene ${desconocidas.length} fila(s) que no corresponden a ninguna migracion de ` +
        `migrations/ (${detalle}). La base viene de migraciones viejas o editadas: no se migra para no ` +
        `re-crear ni saltarse tablas. Revisar a mano (ver packages/infrastructure/README.md, "Migraciones en el deploy").`
    );
  }

  const hashesAplicados = new Set(historial.map((f) => f.hash));
  const ultima = historial.reduce((max, f) => Math.max(max, Number(f.created_at)), -Infinity);
  const aplicadas: MigracionLocal[] = [];
  const pendientes: MigracionLocal[] = [];
  for (const m of locales) {
    if (hashesAplicados.has(m.hash)) aplicadas.push(m);
    else if (m.creadaEn > ultima) pendientes.push(m);
    else
      // drizzle se la saltaria sin avisar: es anterior a la ultima aplicada.
      throw new HistorialInvalido(
        `La migracion ${m.tag} no esta aplicada pero es anterior a la ultima del historial ` +
          `(created_at=${ultima}); drizzle se la saltaria. Revisar el journal y la base a mano.`
      );
  }
  return { aplicadas, pendientes };
}
