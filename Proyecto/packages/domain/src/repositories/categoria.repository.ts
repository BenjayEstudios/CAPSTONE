import type { Categoria } from "../entities/categoria.entity.js";
import type { CrearCategoriaDto, ActualizarCategoriaDto } from "../dtos/categoria.dto.js";

// Puerto (interfaz): lo que la capa de aplicacion necesita de la
// persistencia, sin saber que hay MySQL/Drizzle detras. La implementacion
// concreta vive en @cotizapp/infrastructure (DrizzleCategoriaRepository).
export interface CategoriaRepository {
  // Todas las categorias (activas y ocultas); el filtrado por visibilidad es del caso de uso.
  listar(): Promise<Categoria[]>;
  buscarPorId(id: number): Promise<Categoria | null>;
  buscarPorSlug(slug: string): Promise<Categoria | null>;
  contarHijos(id: number): Promise<number>;
  crear(input: CrearCategoriaDto): Promise<Categoria>;
  actualizar(id: number, cambios: ActualizarCategoriaDto): Promise<Categoria>;
}
