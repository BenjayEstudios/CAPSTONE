import { crearCategoriaSchema, type CategoriaRepository, type CrearCategoriaDto } from "@cotizapp/domain";

export function crearCategoria(deps: { categoriaRepository: CategoriaRepository }) {
  return async (input: CrearCategoriaDto) => {
    // La validacion vive en el DTO de @cotizapp/domain para que la
    // compartan el caso de uso y la ruta HTTP (apps/rest) sin duplicarla.
    const data = crearCategoriaSchema.parse(input);
    return deps.categoriaRepository.crear(data);
  };
}
