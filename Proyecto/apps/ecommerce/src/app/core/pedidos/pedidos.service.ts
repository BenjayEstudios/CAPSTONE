import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { OrdenDetalle } from "../models/checkout.models";

/** GET /ordenes (vista del cliente): sus ordenes, de la mas nueva a la mas antigua. */
export interface PaginaOrdenes {
  items: OrdenDetalle[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

// Historial de compras del comprador (KAN-98). El detalle de una orden y sus
// documentos estan en CheckoutService (los usa tambien el resultado del pago).
@Injectable({ providedIn: "root" })
export class PedidosService {
  private readonly api = inject(ApiClient);

  listar(f: { estado?: string | null; pagina?: number; tamano?: number } = {}): Promise<PaginaOrdenes> {
    const q = new URLSearchParams({ pagina: String(f.pagina ?? 1), tamano: String(f.tamano ?? 10) });
    if (f.estado) q.set("estado", f.estado);
    return firstValueFrom(this.api.get<PaginaOrdenes>(`/ordenes?${q}`));
  }
}
