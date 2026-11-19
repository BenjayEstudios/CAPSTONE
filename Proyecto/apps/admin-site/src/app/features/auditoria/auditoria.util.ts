export type TipoCambio = "agregado" | "quitado" | "cambiado" | "igual";

export interface CambioCampo {
  ruta: string;
  tipo: TipoCambio;
  antes?: unknown;
  despues?: unknown;
}

export const ETIQUETA_ACCION: Record<string, string> = {
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
  aprobar: "Aprobar",
  suspender: "Suspender",
  reembolsar: "Reembolsar"
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Aplana JSON anidado en rutas "a.b" (arreglos: "a.0"). Objetos/arreglos vacios se conservan como hoja. */
export function aplanar(valor: unknown, prefijo = "", salida: Record<string, unknown> = {}): Record<string, unknown> {
  const hijos: Array<[string, unknown]> | null = Array.isArray(valor)
    ? valor.map((v, i): [string, unknown] => [String(i), v])
    : esObjeto(valor)
      ? Object.entries(valor)
      : null;
  if (hijos && hijos.length > 0) {
    for (const [k, v] of hijos) aplanar(v, prefijo ? `${prefijo}.${k}` : k, salida);
  } else if (prefijo) {
    salida[prefijo] = valor;
  } else if (valor !== null && valor !== undefined && !hijos) {
    salida["(valor)"] = valor;
  }
  return salida;
}

/** Diff campo por campo entre dos JSON; rutas en orden alfabetico. */
export function calcularDiff(antes: unknown, despues: unknown): CambioCampo[] {
  const a = aplanar(antes);
  const d = aplanar(despues);
  const rutas = [...new Set([...Object.keys(a), ...Object.keys(d)])].sort();
  return rutas.map((ruta): CambioCampo => {
    const enA = ruta in a;
    const enD = ruta in d;
    if (enA && !enD) return { ruta, tipo: "quitado", antes: a[ruta] };
    if (!enA && enD) return { ruta, tipo: "agregado", despues: d[ruta] };
    const igual = JSON.stringify(a[ruta]) === JSON.stringify(d[ruta]);
    return { ruta, tipo: igual ? "igual" : "cambiado", antes: a[ruta], despues: d[ruta] };
  });
}

export function formatearValor(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}
