export type CategoriaEstado = "activa" | "oculta";

// Entidad de dominio: forma pura de la categoria, sin nada de Drizzle/MySQL.
// Ver DataBase/dbDiagram.sql -> Table categoria.
export interface Categoria {
  id: number;
  padreId: number | null;
  nombre: string;
  slug: string;
  orden: number | null;
  estado: CategoriaEstado;
}
