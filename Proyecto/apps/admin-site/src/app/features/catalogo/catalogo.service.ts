import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { CategoriaItem, FiltrosProductos, ProductoListadoRespuesta } from "../../core/models/catalogo.models";

const fmtCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

// Precio en CLP con formato local; "—" si no hay precio.
export function formatearPrecio(valor: number | null | undefined): string {
  return valor === null || valor === undefined || Number.isNaN(valor) ? "—" : fmtCLP.format(valor);
}

export function construirParams(f: FiltrosProductos): HttpParams {
  let p = new HttpParams();
  if (f.estado) p = p.set("estado", f.estado);
  if (f.categoriaId) p = p.set("categoriaId", f.categoriaId);
  const q = f.q?.trim();
  if (q) p = p.set("q", q);
  p = p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
  return p;
}

// Etiqueta "Padre > Hija" para el select de categorias.
export function etiquetasCategorias(cats: CategoriaItem[]): { id: string; etiqueta: string }[] {
  const porId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => {
      const padre = c.padreId ? porId.get(c.padreId) : undefined;
      return { id: c.id, etiqueta: padre ? `${padre.nombre} > ${c.nombre}` : c.nombre };
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

@Injectable({ providedIn: "root" })
export class CatalogoService {
  private readonly api = inject(ApiClient);

  listar(filtros: FiltrosProductos) {
    return this.api.get<ProductoListadoRespuesta>(`/productos?${construirParams(filtros).toString()}`);
  }

  categorias() {
    return this.api.get<CategoriaItem[]>("/categorias?incluirOcultas=true");
  }
}
