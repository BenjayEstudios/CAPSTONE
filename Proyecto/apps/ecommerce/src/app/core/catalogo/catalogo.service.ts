import { inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { PaginaCatalogo, ProductoCatalogo, ResumenCatalogo } from "../models/catalogo.models";

// Lectura del catalogo publico. El resumen (contadores y categorias) lo usan
// la cabecera y el inicio: se pide una vez por carga y se comparte.
@Injectable({ providedIn: "root" })
export class CatalogoService {
  private readonly api = inject(ApiClient);
  readonly resumen = signal<ResumenCatalogo | null>(null);
  private pedido: Promise<ResumenCatalogo | null> | null = null;

  cargarResumen(): Promise<ResumenCatalogo | null> {
    this.pedido ??= firstValueFrom(this.api.get<ResumenCatalogo>("/catalogo/resumen"))
      .then((r) => {
        this.resumen.set(r);
        return r;
      })
      .catch(() => {
        this.pedido = null; // se reintenta en la proxima vista
        return null;
      });
    return this.pedido;
  }

  /** "Mayor diferencia de precio hoy": productos con 2+ ofertas, de mayor a menor diferencia. */
  async mayorDiferencia(cantidad = 5): Promise<ProductoCatalogo[]> {
    const r = await firstValueFrom(this.api.get<PaginaCatalogo>(`/catalogo/productos?orden=diferencia&porPagina=${cantidad}`));
    return r.items;
  }
}
