export type EstadoCategoria = "activa" | "oculta";

export interface Categoria {
  id: string;
  padreId: string | null;
  nombre: string;
  slug: string;
  orden: number | null;
  estado: EstadoCategoria;
  hijos?: Categoria[];
}

export interface CategoriaCrear {
  nombre: string;
  slug: string;
  padreId?: string;
  orden?: number;
}

export interface CategoriaActualizar {
  nombre?: string;
  slug?: string;
  padreId?: string | null;
  orden?: number | null;
  estado?: EstadoCategoria;
}
