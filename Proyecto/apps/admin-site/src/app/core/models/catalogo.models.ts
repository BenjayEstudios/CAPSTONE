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

export type UnidadProducto = "kg" | "L" | "unidad";

export interface ImagenProducto {
  url: string;
  textoAlt?: string | null;
  esPrincipal: boolean;
  orden?: number;
  ancho?: number | null;
  alto?: number | null;
}

export interface ProductoFicha {
  id: string | number;
  nombre: string;
  sku: string | null;
  ean: string | null;
  categoriaId?: string | number | null;
  categoria: { id: string | number; nombre: string; slug: string; padre: unknown } | null;
  marca: string | null;
  formato: string | null;
  contenido: number | string | null;
  unidad: UnidadProducto;
  descripcion: string | null;
  precioReferencia: number | null;
  topeSobreReferenciaPct: number | null;
  estado: EstadoProducto;
  imagenes: ImagenProducto[];
}

export interface ProductoPayload {
  nombre?: string;
  sku?: string;
  ean?: string | null;
  categoriaId?: number;
  marca?: string | null;
  formato?: string | null;
  contenido?: number | null;
  unidad?: UnidadProducto;
  descripcion?: string | null;
  precioReferencia?: number | null;
  topeSobreReferenciaPct?: number | null;
  estado?: EstadoProducto;
}

export interface ImagenSubida {
  url: string;
  clave: string;
  ancho: number;
  alto: number;
}

// Carga masiva del catalogo desde Excel (POST /productos/importar).
export type AccionImportacion = "crear" | "actualizar" | "sin_cambios" | "error";

export interface FilaImportacionResultado {
  fila: number;
  sku: string | null;
  accion: AccionImportacion;
  productoId?: number;
  error?: { codigo: string; mensaje: string };
}

export interface ResultadoImportacion {
  /** true = solo se valido; no se guardo nada. */
  simulacion: boolean;
  totalFilas: number;
  resumen: { crear: number; actualizar: number; sinCambios: number; errores: number };
  filas: FilaImportacionResultado[];
}
