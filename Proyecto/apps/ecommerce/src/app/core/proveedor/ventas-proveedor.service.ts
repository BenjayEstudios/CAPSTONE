import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";

// Ordenes de venta del proveedor (KAN-105): sus envios (su tramo de cada
// orden pagada) y el cambio de estado de cada uno. Tus clientes (KAN-106).

export type EstadoEnvio = "por_despachar" | "en_preparacion" | "listo_retiro" | "despachado" | "entregado" | "cancelado";

/** GET /proveedor/ventas: un envio del proveedor. */
export interface VentaProveedor {
  envioId: number;
  ordenId: number;
  folio: string;
  cliente: string;
  modalidad: "despacho" | "retiro";
  comuna: string | null;
  fecha: string;
  lineas: number;
  cajas: number;
  monto: number;
  estado: EstadoEnvio;
  ordenEstado: string;
  /** Siguiente paso hacia la entrega; null si ya termino. */
  siguiente: EstadoEnvio | null;
}

export interface PaginaVentas {
  items: VentaProveedor[];
  conteo: Partial<Record<EstadoEnvio, number>>;
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export type Recompra = "Por pagar" | "Primera vez" | "Semanal" | "Quincenal" | "Mensual" | "Esporádica";

/** GET /proveedor/clientes (KAN-106). contacto = null hasta la primera orden pagada. */
export interface ClienteProveedor {
  organizacionId: number;
  nombre: string;
  tipo: "Empresa" | "Persona" | "Institución";
  comuna: string | null;
  ordenes: number;
  pendientes: number;
  monto: number;
  ultimaCompra: string | null;
  recompra: Recompra;
  contacto: { razonSocial: string; rut: string; email: string | null; telefono: string | null } | null;
}

@Injectable({ providedIn: "root" })
export class VentasProveedorService {
  private readonly api = inject(ApiClient);

  listar(f: { estado?: EstadoEnvio | null; pagina?: number; tamano?: number } = {}): Promise<PaginaVentas> {
    const p = new URLSearchParams({ pagina: String(f.pagina ?? 1), tamano: String(f.tamano ?? 50) });
    if (f.estado) p.set("estado", f.estado);
    return firstValueFrom(this.api.get<PaginaVentas>(`/proveedor/ventas?${p}`));
  }

  /** Quien le compro al proveedor (KAN-106), de quien mas compro a quien menos. */
  clientes(pagina = 1, tamano = 50): Promise<{ items: ClienteProveedor[]; total: number; pagina: number; totalPaginas: number }> {
    return firstValueFrom(this.api.get(`/proveedor/clientes?pagina=${pagina}&tamano=${tamano}`));
  }

  /** PATCH /ordenes/envios/:id/estado (la maquina de estados la valida el backend). */
  cambiarEstado(envioId: number, estado: EstadoEnvio): Promise<{ id: number; ordenId: number; estado: EstadoEnvio; ordenEstado: string }> {
    return firstValueFrom(this.api.patch(`/ordenes/envios/${envioId}/estado`, { estado }));
  }
}
