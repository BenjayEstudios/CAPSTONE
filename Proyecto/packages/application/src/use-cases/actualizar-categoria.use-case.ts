import { actualizarCategoriaSchema, type CategoriaRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { validarPadre, validarSlugLibre } from "./categoria-arbol.js";

export function actualizarCategoria(deps: { categoriaRepository: CategoriaRepository }) {
  return async (id: number, input: unknown) => {
    const repo = deps.categoriaRepository;
    const cambios = validar(actualizarCategoriaSchema, input);

    const actual = await repo.buscarPorId(id);
    if (!actual) throw new ErrorAplicacion(404, "CATEGORIA_NO_ENCONTRADA", "La categoria no existe");

    if (cambios.slug !== undefined && cambios.slug !== actual.slug) {
      await validarSlugLibre(repo, cambios.slug, id);
    }
    if (cambios.padreId !== undefined && cambios.padreId !== actual.padreId) {
      await validarPadre(repo, cambios.padreId, id);
    }
    return repo.actualizar(id, cambios);
  };
}
