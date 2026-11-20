import { computed, effect, inject, Injectable, signal, untracked } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { SessionState } from "./session.state";

// Forma de GET /carro (apps/mobile/API_CONTRACT.md, KAN-130).
export interface ItemCarro {
  ofertaId: number;
  cantidad: number;
  precioVisto: number;
  precioActual: number;
  productoId: number;
  nombreProducto: string;
  formato: string | null;
  proveedorId: number;
  disponible: boolean;
  cajasDisponibles: number | null;
}

interface CarroResponse {
  id: number;
  estado: string;
  items: ItemCarro[];
}

// Resumen del carro para la cabecera ("Ver carro · 3 · $45.670"). Solo un
// comprador tiene carro: sin sesion, o con sesion de proveedor, queda vacio.
// Se recarga cuando cambia la sesion; el carro completo es KAN-94.
@Injectable({ providedIn: "root" })
export class CarroState {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionState);
  readonly items = signal<ItemCarro[]>([]);

  /** Productos distintos en el carro. */
  readonly productos = computed(() => this.items().length);
  /** Total a precio actual (precio de la oferta x cantidad, como planificarOrden en el backend). */
  readonly total = computed(() => this.items().reduce((s, i) => s + i.precioActual * i.cantidad, 0));
  readonly proveedores = computed(() => new Set(this.items().map((i) => i.proveedorId)).size);

  constructor() {
    effect(() => {
      const comprador = this.session.esComprador() && !!this.session.token();
      untracked(() => (comprador ? void this.recargar() : this.items.set([])));
    });
  }

  async recargar(): Promise<void> {
    try {
      const carro = await firstValueFrom(this.api.get<CarroResponse>("/carro"));
      this.items.set(carro.items ?? []);
    } catch {
      // Sin carro (404) o error de red: la cabecera muestra 0.
      this.items.set([]);
    }
  }
}
