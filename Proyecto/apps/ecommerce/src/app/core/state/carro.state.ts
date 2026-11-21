import { computed, effect, inject, Injectable, signal, untracked } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { SessionState } from "./session.state";

// Forma de GET /carro (apps/mobile/API_CONTRACT.md, KAN-130). Si la oferta
// ya no existe, los datos del producto vienen en null y `disponible` en false.
export interface ItemCarro {
  ofertaId: number;
  cantidad: number;
  precioVisto: number;
  precioActual: number | null;
  productoId: number | null;
  nombreProducto: string | null;
  formato: string | null;
  proveedorId: number | null;
  disponible: boolean;
  cajasDisponibles: number | null;
}

/** Lo que se manda en PUT /carro por cada linea. */
export interface ItemCarroGuardar {
  ofertaId: number;
  cantidad: number;
  precioVisto: number;
}

interface CarroResponse {
  id: number | null;
  estado: string;
  items: ItemCarro[];
}

// Carro del comprador. Lo usan la cabecera ("Ver carro · 3 · $45.670"), la
// ficha (Comprar) y la pantalla del carro (KAN-94). Solo un comprador tiene
// carro: sin sesion, o con sesion de proveedor, queda vacio. Se recarga
// cuando cambia la sesion.
//
// PUT /carro reemplaza todos los items, asi que cada cambio manda el carro
// completo con ese cambio aplicado. La cantidad va en cajas, como en el backend.
@Injectable({ providedIn: "root" })
export class CarroState {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionState);
  readonly items = signal<ItemCarro[]>([]);
  /** true despues de la primera carga (para no mostrar "carro vacio" mientras carga). */
  readonly cargado = signal(false);

  /** Productos distintos en el carro. */
  readonly productos = computed(() => this.items().length);
  /** Total a precio actual (precio de la oferta x cantidad, como planificarOrden en el backend). */
  readonly total = computed(() => this.items().reduce((s, i) => s + (i.disponible ? (i.precioActual ?? 0) * i.cantidad : 0), 0));
  readonly proveedores = computed(() => new Set(this.items().filter((i) => i.proveedorId !== null).map((i) => i.proveedorId)).size);

  constructor() {
    effect(() => {
      const comprador = this.session.esComprador() && !!this.session.token();
      untracked(() => {
        if (comprador) void this.recargar();
        else {
          this.items.set([]);
          this.cargado.set(false);
        }
      });
    });
  }

  private actuales(): ItemCarroGuardar[] {
    return this.items().map((i) => ({ ofertaId: i.ofertaId, cantidad: i.cantidad, precioVisto: i.precioVisto }));
  }

  /** Reemplaza el carro completo (PUT /carro). */
  async guardar(items: ItemCarroGuardar[]): Promise<void> {
    const carro = await firstValueFrom(this.api.put<CarroResponse>("/carro", { items }));
    this.items.set(carro.items ?? []);
  }

  /** Agrega una oferta (KAN-92/93). Si ya estaba, suma la cantidad. */
  async agregar(ofertaId: number, cantidad: number, precioVisto: number): Promise<void> {
    const actuales = this.actuales();
    const existente = actuales.find((i) => i.ofertaId === ofertaId);
    await this.guardar(
      existente
        ? actuales.map((i) => (i.ofertaId === ofertaId ? { ...i, cantidad: i.cantidad + cantidad, precioVisto } : i))
        : [...actuales, { ofertaId, cantidad, precioVisto }]
    );
  }

  /** Cambia la cantidad (en cajas) de una linea. */
  cambiarCantidad(ofertaId: number, cantidad: number): Promise<void> {
    return this.guardar(this.actuales().map((i) => (i.ofertaId === ofertaId ? { ...i, cantidad } : i)));
  }

  /** Quita una o varias lineas. */
  quitar(...ofertaIds: number[]): Promise<void> {
    return this.guardar(this.actuales().filter((i) => !ofertaIds.includes(i.ofertaId)));
  }

  /**
   * El comprador acepta los precios de hoy: precio_visto pasa a ser el precio
   * actual. Sin esto el checkout responde PRECIO_CAMBIO.
   */
  aceptarPrecios(): Promise<void> {
    return this.guardar(
      this.items().map((i) => ({ ofertaId: i.ofertaId, cantidad: i.cantidad, precioVisto: i.precioActual ?? i.precioVisto }))
    );
  }

  async recargar(): Promise<void> {
    try {
      const carro = await firstValueFrom(this.api.get<CarroResponse>("/carro"));
      this.items.set(carro.items ?? []);
    } catch {
      // Error de red: la cabecera muestra 0.
      this.items.set([]);
    } finally {
      this.cargado.set(true);
    }
  }
}
