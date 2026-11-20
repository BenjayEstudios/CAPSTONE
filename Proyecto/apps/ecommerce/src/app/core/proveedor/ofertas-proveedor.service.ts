import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";

// Ofertas del proveedor de la sesion (API de KAN-146): "Asignarme un
// producto" (KAN-102) y, despues, "Mis productos" (KAN-103).

export interface ProductoDisponible {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  formato: string | null;
  unidad: "kg" | "L" | "unidad";
  contenido: number | null;
  categoriaId: number;
  precioReferencia: number | null;
  topeSobreReferenciaPct: number | null;
}

export type ModalidadEntrega = "despacho" | "retiro" | "ambos";

export interface NuevaOferta {
  productoId: number;
  precioUnitario: number;
  unidadesPorCaja: number;
  cajasDisponibles: number;
  minimoCompra?: number;
  plazoHoras?: number;
  modalidadEntrega: ModalidadEntrega;
  notasCliente?: string;
  estado: "publicada" | "borrador";
}

export interface OfertaCreada {
  oferta: { id: number; productoId: number; precioUnitario: number; estado: string };
  revisionPrecio: { casoId: number; precioReferencia: number; topePct: number; precioMaximo: number } | null;
}

export type EstadoOferta = "borrador" | "publicada" | "pausada";

/** GET /ofertas: una oferta del proveedor con su producto. */
export interface OfertaProveedor {
  id: number;
  productoId: number;
  precioUnitario: number;
  unidadesPorCaja: number | null;
  cajasDisponibles: number | null;
  cajasIniciales: number | null;
  minimoCompra: number | null;
  plazoHoras: number | null;
  modalidadEntrega: ModalidadEntrega;
  notasCliente: string | null;
  estado: EstadoOferta;
  actualizadaEn: string;
  producto: {
    id: number;
    sku: string;
    nombre: string;
    formato: string | null;
    unidad: "kg" | "L" | "unidad";
    contenido: number | null;
    precioReferencia: number | null;
    topeSobreReferenciaPct: number | null;
  };
}

export interface CambioOferta {
  id: number;
  precioAnterior: number | null;
  precioNuevo: number | null;
  cajasAnteriores: number | null;
  cajasNuevas: number | null;
  motivo: string | null;
  cambiadoPor: string | null;
  cambiadoEn: string;
}

export interface CambiosOferta {
  precioUnitario?: number;
  cajasDisponibles?: number;
  estado?: "publicada" | "pausada";
  motivo?: string;
}

/** GET /proveedor/cobertura: valen para todas las ofertas del proveedor. */
export interface CondicionesEntrega {
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  plazoEstandarHoras: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  zonas: Array<{ comunaId: number | null; comuna: string | null; regionCodigo: string; region: string; costoDespacho: number; plazoHoras: number | null }>;
}

@Injectable({ providedIn: "root" })
export class OfertasProveedorService {
  private readonly api = inject(ApiClient);

  productosDisponibles(q: string, tamano = 20): Promise<{ items: ProductoDisponible[]; total: number }> {
    const p = new URLSearchParams({ tamano: String(tamano) });
    if (q.trim()) p.set("q", q.trim());
    return firstValueFrom(this.api.get<{ items: ProductoDisponible[]; total: number }>(`/ofertas/productos-disponibles?${p}`));
  }

  crear(oferta: NuevaOferta): Promise<OfertaCreada> {
    return firstValueFrom(this.api.post<OfertaCreada>("/ofertas", oferta));
  }

  /** Mis ofertas (KAN-103), filtradas por estado o texto. */
  listar(f: { estado?: EstadoOferta | null; q?: string; pagina?: number; tamano?: number } = {}): Promise<{ items: OfertaProveedor[]; total: number }> {
    const p = new URLSearchParams({ pagina: String(f.pagina ?? 1), tamano: String(f.tamano ?? 100) });
    if (f.estado) p.set("estado", f.estado);
    if (f.q?.trim()) p.set("q", f.q.trim());
    return firstValueFrom(this.api.get<{ items: OfertaProveedor[]; total: number }>(`/ofertas?${p}`));
  }

  /** Editar precio o stock, pausar o reactivar. El backend deja cada cambio de precio o stock en el historial. */
  actualizar(id: number, cambios: CambiosOferta): Promise<OfertaCreada & { oferta: OfertaProveedor }> {
    return firstValueFrom(this.api.patch<OfertaCreada & { oferta: OfertaProveedor }>(`/ofertas/${id}`, cambios));
  }

  /** Solo borradores sin ventas. */
  eliminar(id: number): Promise<void> {
    return firstValueFrom(this.api.delete(`/ofertas/${id}`)).then(() => undefined);
  }

  historial(id: number): Promise<CambioOferta[]> {
    return firstValueFrom(this.api.get<{ items: CambioOferta[] }>(`/ofertas/${id}/historial`)).then((r) => r.items);
  }

  condicionesEntrega(): Promise<CondicionesEntrega> {
    return firstValueFrom(this.api.get<CondicionesEntrega>("/proveedor/cobertura"));
  }
}

/** Tope de publicacion: referencia x (1 + tope%), igual que precioMaximoSinRevision del backend. */
export function precioMaximo(p: Pick<ProductoDisponible, "precioReferencia" | "topeSobreReferenciaPct">): number | null {
  if (p.precioReferencia === null || p.topeSobreReferenciaPct === null) return null;
  return Math.floor((p.precioReferencia * (100 + p.topeSobreReferenciaPct)) / 100);
}
