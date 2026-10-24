export type EstadoProducto = "borrador" | "publicado" | "archivado";

export interface ProductoListadoItem {
  id: string;
  nombre: string;
  sku: string | null;
  ean: string | null;
  categoria: { id: string; nombre: string } | null;
  formato: string | null;
  proveedoresConOfertaActiva: number;
  precioDesde: number | null;
  nImagenes: number;
  estado: EstadoProducto;
}

export interface ProductoListadoRespuesta {
  items: ProductoListadoItem[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosProductos {
  estado?: EstadoProducto | "";
  categoriaId?: string;
  q?: string;
  pagina?: number;
  tamano?: number;
}

export interface CategoriaItem {
  id: string;
  padreId: string | null;
  nombre: string;
  slug: string;
  orden: number;
  estado: string;
}
