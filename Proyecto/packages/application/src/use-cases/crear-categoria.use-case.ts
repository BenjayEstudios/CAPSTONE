import { crearCategoriaSchema, type CategoriaRepository, type CrearCategoriaDto } from "@cotizapp/domain";
import { validar } from "../validacion.js";
import { validarPadre, validarSlugLibre } from "./categoria-arbol.js";

export function crearCategoria(deps: { categoriaRepository: CategoriaRepository }) {
  return async (input: CrearCategoriaDto) => {
    // La validacion vive en el DTO de @cotizapp/domain para que la
    // compartan el caso de uso y la ruta HTTP (apps/backend) sin duplicarla.
    const data = validar(crearCategoriaSchema, input);
    await validarSlugLibre(deps.categoriaRepository, data.slug);
    await validarPadre(deps.categoriaRepository, data.padreId);
    return deps.categoriaRepository.crear(data);
  };
}
