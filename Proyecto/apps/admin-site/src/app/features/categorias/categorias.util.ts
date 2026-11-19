import { Categoria } from "./categorias.models";

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Ropa de Niños" -> "ropa-de-ninos"
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CambioOrden {
  id: string;
  orden: number;
}

export function ordenarHermanos(lista: readonly Categoria[]): Categoria[] {
  const max = Number.MAX_SAFE_INTEGER;
  return [...lista].sort((a, b) => (a.orden ?? max) - (b.orden ?? max) || a.nombre.localeCompare(b.nombre));
}

// Intercambia `id` con su hermano anterior/siguiente y reindexa 0..n-1;
// devuelve solo los hermanos cuyo orden cambia (a persistir con PATCH).
export function calcularCambiosOrden(hermanos: readonly Categoria[], id: string, dir: "subir" | "bajar"): CambioOrden[] {
  const lista = ordenarHermanos(hermanos);
  const i = lista.findIndex((c) => c.id === id);
  const j = dir === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return [];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista.map((c, idx) => ({ id: c.id, orden: idx, previo: c.orden })).filter((x) => x.previo !== x.orden).map(({ id: cid, orden }) => ({ id: cid, orden }));
}
