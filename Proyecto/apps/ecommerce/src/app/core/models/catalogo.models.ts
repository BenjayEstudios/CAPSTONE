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

// GET /catalogo/productos/:id (KAN-92): ficha con el comparador.
export interface OfertaFicha {
  id: number;
  precioUnitario: number;
  precioNormalizado: { valor: number; por: Unidad } | null;
  unidadesPorCaja: number | null;
  cajasDisponibles: number | null;
  minimoCompra: number | null;
  plazoHoras: number | null;
  modalidadEntrega: "despacho" | "retiro" | "ambos";
  notasCliente: string | null;
  proveedor: {
    id: number;
    nombre: string;
    entregasATiempoPct: number | null;
    despachoGratisDesde: number | null;
    costoDespacho: number | null;
    zona: { comuna: string; region: string } | null;
    calificacion: { promedio: number | null; cantidad: number };
  };
}

export interface FichaProducto {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  contenido: number | null;
  unidad: Unidad;
  categoriaId: number;
  imagenUrl: string | null;
  descripcion: string | null;
  precioReferencia: number | null;
  categoria: { id: number; nombre: string; padre: { id: number; nombre: string } | null };
  /** Ordenadas por precio unitario ascendente. */
  ofertas: OfertaFicha[];
}

export type OrigenVisita = "catalogo" | "busqueda" | "directo";
