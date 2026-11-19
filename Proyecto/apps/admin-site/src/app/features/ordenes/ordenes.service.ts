import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { FiltrosOrdenes, OrdenDetalle, OrdenesRespuesta } from "../../core/models/ordenes.models";

export function construirParams(f: FiltrosOrdenes): HttpParams {
  let p = new HttpParams();
  if (f.estado) p = p.set("estado", f.estado);
  return p.set("pagina", String(f.pagina ?? 1)).set("tamano", String(f.tamano ?? 20));
}

@Injectable({ providedIn: "root" })
export class OrdenesService {
  private readonly api = inject(ApiClient);

  listar(f: FiltrosOrdenes) {
    return this.api.get<OrdenesRespuesta>(`/ordenes?${construirParams(f).toString()}`);
  }
  obtener(id: number) {
    return this.api.get<OrdenDetalle>(`/ordenes/${id}`);
  }
}
