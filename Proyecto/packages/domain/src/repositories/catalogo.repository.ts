import type { FichaCatalogoDto, MarcaConConteoDto, OfertaCatalogoDto, OrdenCatalogo, ProductoCatalogoDto } from "../dtos/catalogo.dto.js";

export interface FiltrosCatalogo {
  q?: string;
  /** La categoria pedida y sus subcategorias (las arma el caso de uso). */
  categoriaIds?: number[];
  plazoMaxHoras?: number;
  maxUnidadesPorCaja?: number;
  maxMinimoCompra?: number;
  conRetiro?: boolean;
  marca?: string;
  orden: OrdenCatalogo;
  pagina: number;
  porPagina: number;
}

/** Zona del comprador para elegir la tarifa de despacho. */
export interface ZonaComprador {
  regionCodigo: string;
  comunaId: number | null;
}

// La ficha tal como sale de la base: sin calificacion ni precio normalizado
// (los agrega el caso de uso).
export type OfertaCatalogoBase = Omit<OfertaCatalogoDto, "precioNormalizado" | "proveedor"> & {
  proveedor: Omit<OfertaCatalogoDto["proveedor"], "calificacion">;
};
export type FichaCatalogoBase = Omit<FichaCatalogoDto, "ofertas"> & { ofertas: OfertaCatalogoBase[] };

// Puerto de lectura del catalogo publico (KAN-145). Solo productos
// publicados, en categorias visibles, con ofertas visibles: oferta publicada
// de un proveedor con organizacion activa.
export interface CatalogoRepository {
  listar(filtros: FiltrosCatalogo): Promise<{ items: ProductoCatalogoDto[]; total: number; marcas: MarcaConConteoDto[] }>;
  obtenerFicha(productoId: number, zona: ZonaComprador): Promise<FichaCatalogoBase | null>;
  /** Region y comuna de la direccion de la organizacion; null si no tiene. */
  zonaDeOrganizacion(organizacionId: number): Promise<ZonaComprador | null>;
  /** Proveedores activos y productos visibles por categoria (mismo criterio de visibilidad que listar). */
  resumen(): Promise<{ proveedoresActivos: number; productosPorCategoria: Array<{ categoriaId: number; productos: number }> }>;
}
