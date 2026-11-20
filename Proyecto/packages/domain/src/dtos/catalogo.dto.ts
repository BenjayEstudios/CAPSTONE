import { z } from "zod";
import type { ProductoUnidad } from "../entities/producto.entity.js";

// Catalogo publico del comprador (KAN-145): GET /catalogo/productos y
// GET /catalogo/productos/:id. Contrato en apps/mobile/API_CONTRACT.md.
// No confundir con GET /productos (listado de administracion).

export const ORDENES_CATALOGO = ["relevancia", "precio", "diferencia", "nombre"] as const;
export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number];

const entero = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const listarCatalogoQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  categoriaId: entero(1, 65_535).optional(),
  plazoMaxHoras: entero(1, 10_000).optional(),
  maxUnidadesPorCaja: entero(1, 10_000).optional(),
  orden: z.enum(ORDENES_CATALOGO).default("relevancia"),
  pagina: entero(1, 10_000).default(1),
  porPagina: entero(1, 100).default(20)
});
export type ListarCatalogoQueryDto = z.input<typeof listarCatalogoQuerySchema>;

export const fichaCatalogoQuerySchema = z.object({
  // De donde viene la visita. Hoy no se registra en el servidor (las apps
  // mandan vista_producto por /eventos/lote); se acepta para no romper el contrato.
  origen: z.enum(["catalogo", "busqueda", "directo"]).optional()
});

/** Producto del listado: rango de precios de sus ofertas visibles. */
export interface ProductoCatalogoDto {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  contenido: number | null;
  unidad: ProductoUnidad;
  categoriaId: number;
  imagenUrl: string | null;
  precioDesde: number;
  precioHasta: number;
  ofertas: number;
  plazoMinHoras: number | null;
}

export interface PaginaCatalogoDto {
  items: ProductoCatalogoDto[];
  total: number;
  pagina: number;
  porPagina: number;
}

/**
 * Precio normalizado para comparar formatos distintos (bidon de 5 L vs
 * botella de 1 L): precio unitario / contenido, por kg, por L o por unidad.
 * null si el producto no declara contenido.
 */
export interface PrecioNormalizadoDto {
  valor: number;
  por: ProductoUnidad;
}

export interface OfertaCatalogoDto {
  id: number;
  precioUnitario: number;
  precioNormalizado: PrecioNormalizadoDto | null;
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
    /** Tarifa de proveedor_cobertura para la zona del comprador (RM si no se conoce); null si no despacha ahi. */
    costoDespacho: number | null;
    calificacion: { promedio: number | null; cantidad: number };
  };
}

export interface FichaCatalogoDto {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  contenido: number | null;
  unidad: ProductoUnidad;
  categoriaId: number;
  imagenUrl: string | null;
  descripcion: string | null;
  precioReferencia: number | null;
  categoria: { id: number; nombre: string; padre: { id: number; nombre: string } | null };
  /** Ordenadas por precioUnitario ascendente (el comparador). */
  ofertas: OfertaCatalogoDto[];
}
