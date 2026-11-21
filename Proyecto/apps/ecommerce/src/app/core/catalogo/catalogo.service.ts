import { HttpParams } from "@angular/common/http";
import { computed, inject, Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import { CategoriaConConteo, FichaProducto, FiltrosCatalogo, PaginaCatalogo, ProductoCatalogo, ResumenCatalogo } from "../models/catalogo.models";

// Lectura del catalogo publico. El resumen (contadores y categorias) lo usan
// la cabecera, el inicio y los filtros: se pide una vez por carga y se comparte.
@Injectable({ providedIn: "root" })
export class CatalogoService {
  private readonly api = inject(ApiClient);
  readonly resumen = signal<ResumenCatalogo | null>(null);
  private pedido: Promise<ResumenCatalogo | null> | null = null;

  /** Categorias (nivel 1 y 2) en una lista plana, para buscar por id. */
  readonly categoriasPorId = computed(() => {
    const mapa = new Map<number, CategoriaConConteo & { padre: CategoriaConConteo | null }>();
    for (const c of this.resumen()?.categorias ?? []) {
      mapa.set(c.id, { ...c, padre: null });
      for (const h of c.hijos) mapa.set(h.id, { ...h, padre: c });
    }
    return mapa;
  });

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

  /** GET /catalogo/productos con los filtros dados (los vacios no se mandan). */
  listar(f: FiltrosCatalogo): Promise<PaginaCatalogo> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(f)) {
      if (v === undefined || v === null || v === "" || v === false) continue;
      params = params.set(k, String(v));
    }
    const qs = params.toString();
    return firstValueFrom(this.api.get<PaginaCatalogo>(`/catalogo/productos${qs ? `?${qs}` : ""}`));
  }

  /** Ficha con el comparador. Con sesion de comprador, el costo de despacho es el de su comuna. */
  ficha(id: number): Promise<FichaProducto> {
    return firstValueFrom(this.api.get<FichaProducto>(`/catalogo/productos/${id}`));
  }

  /** "Mayor diferencia de precio hoy": productos con 2+ ofertas, de mayor a menor diferencia. */
  async mayorDiferencia(cantidad = 5): Promise<ProductoCatalogo[]> {
    const r = await this.listar({ orden: "diferencia", porPagina: cantidad });
    return r.items;
  }
}
