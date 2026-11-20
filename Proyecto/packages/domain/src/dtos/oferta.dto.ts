import { z } from "zod";
import type { ProductoUnidad } from "../entities/producto.entity.js";

// Ofertas del proveedor (KAN-146): una por producto x proveedor. Siempre se
// opera sobre las ofertas de la organizacion de la sesion.

export const OFERTA_ESTADOS = ["borrador", "publicada", "pausada"] as const;
export type OfertaEstado = (typeof OFERTA_ESTADOS)[number];
export const MODALIDADES_ENTREGA = ["despacho", "retiro", "ambos"] as const;
export type ModalidadEntrega = (typeof MODALIDADES_ENTREGA)[number];

const entero = (min: number, max: number) => z.number().int().min(min).max(max);
const camposOferta = {
  precioUnitario: entero(1, 100_000_000),
  unidadesPorCaja: entero(1, 10_000).nullable().optional(),
  cajasDisponibles: entero(0, 10_000_000).nullable().optional(),
  minimoCompra: entero(1, 10_000).nullable().optional(),
  plazoHoras: entero(1, 720).nullable().optional(),
  modalidadEntrega: z.enum(MODALIDADES_ENTREGA),
  notasCliente: z.string().trim().max(240).nullable().optional()
};

// POST /ofertas. estado: "publicada" (default) o "borrador" para dejarla lista sin mostrarla.
export const crearOfertaSchema = z.object({
  productoId: entero(1, Number.MAX_SAFE_INTEGER),
  ...camposOferta,
  estado: z.enum(["borrador", "publicada"]).default("publicada")
});
export type CrearOfertaDto = z.input<typeof crearOfertaSchema>;

// PATCH /ofertas/:id. motivo (opcional) queda en oferta_precio_historial.
export const actualizarOfertaSchema = z
  .object({
    precioUnitario: camposOferta.precioUnitario.optional(),
    unidadesPorCaja: camposOferta.unidadesPorCaja,
    cajasDisponibles: camposOferta.cajasDisponibles,
    minimoCompra: camposOferta.minimoCompra,
    plazoHoras: camposOferta.plazoHoras,
    modalidadEntrega: camposOferta.modalidadEntrega.optional(),
    notasCliente: camposOferta.notasCliente,
    estado: z.enum(["publicada", "pausada"]).optional(),
    motivo: z.string().trim().min(1).max(120).optional()
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== "motivo" && x !== undefined), {
    message: "Indica al menos un campo a modificar"
  });
export type ActualizarOfertaDto = z.input<typeof actualizarOfertaSchema>;

export const listarMisOfertasQuerySchema = z.object({
  estado: z.enum(OFERTA_ESTADOS).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});

export const productosDisponiblesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20)
});

/** Oferta tal como la ve su proveedor, con los datos del producto. */
export interface OfertaProveedorDto {
  id: number;
  productoId: number;
  proveedorId: number;
  precioUnitario: number;
  unidadesPorCaja: number | null;
  cajasDisponibles: number | null;
  cajasIniciales: number | null;
  minimoCompra: number | null;
  plazoHoras: number | null;
  modalidadEntrega: ModalidadEntrega;
  notasCliente: string | null;
  estado: OfertaEstado;
  actualizadaEn: Date;
  producto: {
    id: number;
    sku: string;
    nombre: string;
    formato: string | null;
    unidad: ProductoUnidad;
    precioReferencia: number | null;
  };
}

/** Si el precio supera el tope sobre la referencia: el caso de moderacion abierto. */
export interface RevisionPrecioDto {
  casoId: number;
  precioReferencia: number;
  topePct: number;
  precioMaximo: number;
}

export interface ResultadoOfertaDto {
  oferta: OfertaProveedorDto;
  revisionPrecio: RevisionPrecioDto | null;
}

/** Producto publicado al que el proveedor todavia no le asigno oferta (KAN-102). */
export interface ProductoDisponibleDto {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  unidad: ProductoUnidad;
  categoriaId: number;
  precioReferencia: number | null;
  topeSobreReferenciaPct: number | null;
}
