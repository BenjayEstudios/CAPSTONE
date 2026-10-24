import type { Producto, ProductoEstado, ProductoImagen, ProductoListado, ResumenOfertas } from "../entities/producto.entity.js";
import type { CrearProductoDto, ActualizarProductoDto } from "../dtos/producto.dto.js";

export interface FiltrosProductos {
  estado?: ProductoEstado;
  categoriaIds?: number[];
  q?: string;
  pagina: number;
  tamano: number;
}

export interface PaginaProductos {
  items: ProductoListado[];
  total: number;
}

export interface NuevoProducto extends Omit<CrearProductoDto, "estado"> {
  estado: ProductoEstado;
  creadoPor: number | null;
}

export type CambiosProducto = ActualizarProductoDto & { imagenes?: ProductoImagen[] };

// Puerto de persistencia de productos. Implementacion en @cotizapp/infrastructure.
export interface ProductoRepository {
  listar(filtros: FiltrosProductos): Promise<PaginaProductos>;
  buscarPorId(id: number): Promise<Producto | null>;
  buscarPorSku(sku: string): Promise<Producto | null>;
  buscarPorEan(ean: string): Promise<Producto | null>;
  resumenOfertas(productoId: number): Promise<ResumenOfertas>;
  crear(input: NuevoProducto): Promise<Producto>;
  actualizar(id: number, cambios: CambiosProducto): Promise<Producto>;
}
