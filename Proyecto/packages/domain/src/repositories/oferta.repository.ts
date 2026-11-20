import type {
  ModalidadEntrega,
  OfertaEstado,
  OfertaProveedorDto,
  ProductoDisponibleDto,
  CambioOfertaDto
} from "../dtos/oferta.dto.js";
import type { ProductoEstado } from "../entities/producto.entity.js";

export interface DatosOferta {
  precioUnitario: number;
  unidadesPorCaja: number | null;
  cajasDisponibles: number | null;
  minimoCompra: number | null;
  plazoHoras: number | null;
  modalidadEntrega: ModalidadEntrega;
  notasCliente: string | null;
  estado: OfertaEstado;
}

export interface NuevaOferta extends DatosOferta {
  productoId: number;
  proveedorId: number;
}

/** Fila de oferta_precio_historial (solo insercion). */
export interface CambioPrecioStock {
  precioAnterior: number | null;
  precioNuevo: number | null;
  cajasAnteriores: number | null;
  cajasNuevas: number | null;
  motivo: string | null;
  cambiadoPor: number;
}

/** Lo que hace falta del producto para ofertarlo y revisar el tope de precio. */
export interface ProductoParaOfertar {
  id: number;
  nombre: string;
  estado: ProductoEstado;
  precioReferencia: number | null;
  topeSobreReferenciaPct: number | null;
}

// Puerto de ofertas (KAN-146). Las escrituras que cambian precio o stock
// insertan su fila de oferta_precio_historial en la MISMA transaccion.
export interface OfertaRepository {
  listarDeProveedor(
    proveedorId: number,
    f: { estado?: OfertaEstado; q?: string; pagina: number; tamano: number }
  ): Promise<{ items: OfertaProveedorDto[]; total: number }>;
  buscarPorId(id: number): Promise<OfertaProveedorDto | null>;
  buscarPorProductoYProveedor(productoId: number, proveedorId: number): Promise<OfertaProveedorDto | null>;
  productoParaOfertar(productoId: number): Promise<ProductoParaOfertar | null>;
  productosDisponibles(
    proveedorId: number,
    f: { q?: string; categoriaId?: number; pagina: number; tamano: number }
  ): Promise<{ items: ProductoDisponibleDto[]; total: number }>;
  tieneVentas(ofertaId: number): Promise<boolean>;
  /** cajas_iniciales = cajasDisponibles. Inserta la fila inicial del historial. */
  crear(oferta: NuevaOferta, historial: CambioPrecioStock): Promise<OfertaProveedorDto>;
  actualizar(id: number, cambios: Partial<DatosOferta>, historial: CambioPrecioStock | null): Promise<OfertaProveedorDto>;
  /** Borra la oferta y su historial (solo para borradores sin ventas). */
  eliminar(id: number): Promise<void>;
  /** Ultimos cambios de precio y stock de la oferta (oferta_precio_historial), del mas nuevo al mas viejo. */
  historial(ofertaId: number, limite: number): Promise<CambioOfertaDto[]>;
}
