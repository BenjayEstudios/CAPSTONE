// Contrato de /catalogo (apps/backend, KAN-145 y KAN-89).

export type Unidad = "kg" | "L" | "unidad";

export interface CategoriaConConteo {
  id: number;
  nombre: string;
  slug: string;
  productos: number;
  hijos: CategoriaConConteo[];
}

export interface ResumenCatalogo {
  proveedoresActivos: number;
  productosComparados: number;
  categorias: CategoriaConConteo[];
}

export interface ProductoCatalogo {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  contenido: number | null;
  unidad: Unidad;
  categoriaId: number;
  imagenUrl: string | null;
  precioDesde: number;
  precioHasta: number;
  ofertas: number;
  plazoMinHoras: number | null;
}

export interface PaginaCatalogo {
  items: ProductoCatalogo[];
  total: number;
  pagina: number;
  porPagina: number;
}
