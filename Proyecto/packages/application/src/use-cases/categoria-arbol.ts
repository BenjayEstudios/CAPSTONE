import type { Categoria, CategoriaRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

// Reglas del arbol de categorias (maximo 2 niveles). `id` es la categoria
// que se crea/edita (undefined al crear).
export async function validarPadre(
  repo: CategoriaRepository,
  padreId: number | null | undefined,
  id?: number
): Promise<void> {
  if (padreId === null || padreId === undefined) return;
  if (id !== undefined && padreId === id) {
    throw new ErrorAplicacion(400, "CATEGORIA_PADRE_INVALIDO", "Una categoria no puede ser su propio padre");
  }
  const padre = await repo.buscarPorId(padreId);
  if (!padre) throw new ErrorAplicacion(400, "CATEGORIA_PADRE_NO_EXISTE", "La categoria padre no existe");
  if (padre.padreId !== null) {
    throw new ErrorAplicacion(400, "ARBOL_MAXIMO_2_NIVELES", "El padre ya es una subcategoria: el arbol admite maximo 2 niveles");
  }
  if (id !== undefined && (await repo.contarHijos(id)) > 0) {
    throw new ErrorAplicacion(400, "ARBOL_MAXIMO_2_NIVELES", "La categoria tiene subcategorias y no puede pasar a ser hija");
  }
}

export async function validarSlugLibre(repo: CategoriaRepository, slug: string, id?: number): Promise<void> {
  const otra = await repo.buscarPorSlug(slug);
  if (otra && otra.id !== id) {
    throw new ErrorAplicacion(409, "SLUG_DUPLICADO", `Ya existe una categoria con el slug "${slug}"`);
  }
}

export type CategoriaNodo = Categoria & { hijos: Categoria[] };
