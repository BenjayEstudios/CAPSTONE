import type { Categoria, CategoriaRepository, ListarCategoriasQueryDto } from "@cotizapp/domain";
import type { CategoriaNodo } from "./categoria-arbol.js";

const porOrden = (a: Categoria, b: Categoria) =>
  (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) || a.nombre.localeCompare(b.nombre);

// Caso de uso: funcion pura que recibe sus dependencias explicitas (aca,
// el repositorio) y devuelve otra funcion con la operacion en si.
// - Por defecto (publico): solo activas, y sin subcategorias de un padre oculto.
// - incluirOcultas (solo admin; la ruta lo exige): todas.
// - Lista plana ordenada (padres primero por orden, luego sus hijos) o, con
//   arbol=true, [{...padre, hijos:[...]}] ordenado por `orden`.
export function listarCategorias(deps: { categoriaRepository: CategoriaRepository }) {
  return async (opts: ListarCategoriasQueryDto = {}): Promise<Categoria[] | CategoriaNodo[]> => {
    const todas = await deps.categoriaRepository.listar();
    const ocultas = new Set(todas.filter((c) => c.estado === "oculta").map((c) => c.id));
    const visibles = opts.incluirOcultas
      ? todas
      : todas.filter((c) => c.estado === "activa" && (c.padreId === null || !ocultas.has(c.padreId)));

    const raices = visibles.filter((c) => c.padreId === null).sort(porOrden);
    const hijosDe = (id: number) => visibles.filter((c) => c.padreId === id).sort(porOrden);

    if (opts.arbol) return raices.map((r) => ({ ...r, hijos: hijosDe(r.id) }));
    // Hijos cuyo padre no esta visible (no deberia ocurrir) se omiten.
    return raices.flatMap((r) => [r, ...hijosDe(r.id)]);
  };
}
