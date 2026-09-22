import type { Categoria } from "../entities/categoria.entity.js";
import type { CrearCategoriaDto } from "../dtos/categoria.dto.js";

// Puerto (interfaz): lo que la capa de aplicacion necesita de la
// persistencia, sin saber que hay MySQL/Drizzle detras. La implementacion
// concreta vive en @cotizapp/infrastructure (DrizzleCategoriaRepository).
export interface CategoriaRepository {
  listar(): Promise<Categoria[]>;
  crear(input: CrearCategoriaDto): Promise<Categoria>;
}
