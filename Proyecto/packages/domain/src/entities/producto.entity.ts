export type ProductoUnidad = "kg" | "L" | "unidad";
export type ProductoEstado = "borrador" | "publicado" | "archivado";

// Elemento de producto.imagenes (JSON del DBML). ancho/alto son extras
// opcionales (no estan en la nota del DBML).
export interface ProductoImagen {
  url: string;
  textoAlt: string | null;
  orden: number;
  esPrincipal: boolean;
  subidaPor: number | null;
  subidaEn: string; // ISO 8601
  ancho?: number;
  alto?: number;
}

// Ver DataBase/dbDiagram.sql -> Table producto.
export interface Producto {
  id: number;
  categoriaId: number;
  sku: string;
  ean: string | null;
  nombre: string;
  marca: string | null;
  formato: string | null;
  contenido: number | null;
  unidad: ProductoUnidad;
  descripcion: string | null;
  precioReferencia: number | null;
  topeSobreReferenciaPct: number | null;
  imagenes: ProductoImagen[];
  estado: ProductoEstado;
  creadoPor: number | null;
  creadoEn: Date;
}

// Fila del listado admin.
export interface ProductoListado {
  id: number;
  nombre: string;
  sku: string;
  ean: string | null;
  categoria: { id: number; nombre: string };
  formato: string | null;
  proveedoresConOfertaActiva: number;
  precioDesde: number | null;
  nImagenes: number;
  estado: ProductoEstado;
}

export interface ResumenOfertas {
  proveedoresConOfertaActiva: number;
  precioDesde: number | null;
}
