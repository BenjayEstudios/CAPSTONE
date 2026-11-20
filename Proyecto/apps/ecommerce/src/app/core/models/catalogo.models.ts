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
  proveedorMasBarato: { id: number; nombre: string };
}

export interface MarcaConConteo {
  marca: string;
  productos: number;
}

export interface PaginaCatalogo {
  items: ProductoCatalogo[];
  total: number;
  pagina: number;
  porPagina: number;
  marcas: MarcaConConteo[];
}

export type OrdenCatalogo = "relevancia" | "precio" | "diferencia" | "nombre";

/** Parametros de GET /catalogo/productos (todos opcionales). */
export interface FiltrosCatalogo {
  q?: string;
  categoriaId?: number;
  plazoMaxHoras?: number;
  maxMinimoCompra?: number;
  conRetiro?: boolean;
  marca?: string;
  orden?: OrdenCatalogo;
  pagina?: number;
  porPagina?: number;
}
